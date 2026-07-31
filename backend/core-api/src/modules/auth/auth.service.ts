import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { AccessTokenPayload } from '@finance-crm/common';
import {
  ACCESS_TOKEN_COOKIE,
  parseUserAgent,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '@finance-crm/common';
import {
  PasswordResetRequest,
  RefreshToken,
  User,
  UserActivityLog,
  UserActivityType,
  UserRole,
} from '@finance-crm/database';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { IsNull, MoreThan, type Repository } from 'typeorm';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { SignInDto } from './dto/sign-in.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import { NotificationsService } from './notifications.service';

const OTP_VALIDITY_MINUTES = 10;
const RESET_TOKEN_VALIDITY_MINUTES = 10;
const MAX_FAILED_LOGIN_ATTEMPTS = 3;
const DEFAULT_PASSWORD_EXPIRY_DAYS = 14;

/** Wrong OTP guesses tolerated per reset request before it is burned. A
 * 6-digit OTP is only 10^6 wide — the request-level rate limit
 * (`ThrottlerModule` on the auth routes) slows an attacker down, but only
 * this cap makes the search space unreachable no matter how patient they
 * are. Burning the request (not the account) means a genuine typo costs a
 * new OTP email, never a lockout. */
const MAX_OTP_ATTEMPTS = 5;

/**
 * Deliberately distinct from the generic "invalid email or password". This is
 * an internal staff CRM, and every one of the 184 migrated legacy users hits
 * this exactly once at cutover — telling them to reset is the whole point. The
 * account-enumeration this leaks is not a meaningful risk for a staff-only
 * login, and the alternative is 184 people seeing "wrong password" for a
 * password that is in fact correct.
 */
const PASSWORD_RESET_REQUIRED_MESSAGE =
  'Set a new password before signing in — use "forgot password" to receive an OTP.';

/**
 * Ports legacy's `LoginController::dashboard()` (:207-214) rolling
 * password-expiry redirect — same trigger (unset or >`PASSWORD_EXPIRY_DAYS`
 * days since the last reset), same point in the flow (after credentials are
 * verified, before login stats are recorded), same "go reset it" outcome,
 * just a 401 instead of a redirect since this is now a stateless API.
 * Distinct message from `PASSWORD_RESET_REQUIRED_MESSAGE` so the frontend
 * can route a never-migrated legacy user and a genuinely-expired-password
 * user to the same "forgot password" flow without conflating the two in
 * copy (one has never set a real password yet, the other has just let it go
 * stale).
 */
const PASSWORD_EXPIRED_MESSAGE =
  'Your password has expired — use "forgot password" to set a new one before signing in.';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetRequest)
    private readonly passwordResetRequestRepository: Repository<PasswordResetRequest>,
    @InjectRepository(UserActivityLog)
    private readonly userActivityLogRepository: Repository<UserActivityLog>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async signIn(
    dto: SignInDto,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<TokenPair & { user: SafeUser }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!this.isUsableAccount(user)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.failedLoginCount > MAX_FAILED_LOGIN_ATTEMPTS) {
      throw new UnauthorizedException(
        'Account locked due to too many failed login attempts',
      );
    }

    const passwordMatches = await this.verifyPassword(user, dto.password);
    if (!passwordMatches) {
      user.failedLoginCount += 1;
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertPasswordNotExpired(user);

    user.failedLoginCount = 0;
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress ?? null;
    await this.userRepository.save(user);

    const roles = await this.getRoleCodesForUser(user.id);
    const tokens = await this.issueTokenPair(user, roles);
    await this.recordActivity(
      user,
      UserActivityType.LOGIN,
      ipAddress,
      userAgent,
    );
    return { ...tokens, user: toSafeUser(user, roles) };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (!existing || existing.revokedAt) {
      // Reuse detection. Tokens rotate on every refresh, so a token that
      // exists but is already revoked means two parties hold the same one —
      // i.e. it was stolen, and either the thief or the legitimate user has
      // now replayed it. Revoking the whole family forces re-authentication
      // and caps the theft at one rotation, instead of letting the thief keep
      // refreshing indefinitely on the branch the real user didn't take.
      await this.revokeFamilyOnReuse(tokenHash);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // The account has to still be usable. Without this, deactivating or
    // soft-deleting a user left their refresh token working: it would mint a
    // fresh access token indefinitely, which `JwtStrategy.validate` then
    // rejects on the next request — so the session neither worked nor ended,
    // and the client saw a bare 401 on every call instead of being logged
    // out. `signIn` has always applied this same check.
    // `isUsableAccount` is a type guard, so it can't be negated here —
    // `existing.user` is already typed `User`, which narrows to `never` in the
    // false branch and makes `.id` unreachable. Read the id first.
    const refreshingUserId = existing.user.id;
    if (!existing.user.isActive || existing.user.isDeleted) {
      await this.revokeAllRefreshTokensForUser(refreshingUserId);
      throw new UnauthorizedException('Account is no longer active');
    }

    existing.revokedAt = new Date();
    await this.refreshTokenRepository.save(existing);

    const roles = await this.getRoleCodesForUser(existing.user.id);
    return this.issueTokenPair(existing.user, roles);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: { user: true },
    });
    if (!existing) {
      return;
    }

    existing.revokedAt = new Date();
    await this.refreshTokenRepository.save(existing);
    await this.recordActivity(
      existing.user,
      UserActivityType.LOGOUT,
      undefined,
      undefined,
    );
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    const currentPasswordMatches = await this.verifyPassword(
      user,
      dto.currentPassword,
    );
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await this.hashPassword(dto.newPassword);
    user.lastPasswordResetAt = new Date();
    user.failedLoginCount = 0;
    await this.userRepository.save(user);
    await this.revokeAllRefreshTokensForUser(userId);
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    requestContext: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!this.isUsableAccount(user)) {
      return;
    }

    // Burn any request still outstanding for this user first. Without this,
    // every unconsumed OTP stays independently guessable for its full
    // validity window, so repeatedly hitting this endpoint multiplies the
    // number of live 6-digit secrets instead of rotating one.
    await this.invalidateOutstandingResetRequests(user.id);

    const otp = generateNumericOtp();
    const resetRequest = this.passwordResetRequestRepository.create({
      user,
      otpHash: await bcrypt.hash(otp, this.getSaltRounds()),
      otpExpiresAt: minutesFromNow(OTP_VALIDITY_MINUTES),
    });
    await this.passwordResetRequestRepository.save(resetRequest);
    await this.notificationsService.sendPasswordResetOtp(user.email, otp, {
      name: user.name,
      ...requestContext,
    });
  }

  async verifyPasswordResetOtp(
    dto: VerifyOtpDto,
  ): Promise<{ resetToken: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    const invalidOtpError = new BadRequestException('Invalid or expired OTP');
    if (!user) {
      throw invalidOtpError;
    }

    const resetRequest = await this.passwordResetRequestRepository.findOne({
      where: {
        user: { id: user.id },
        consumedAt: IsNull(),
        otpExpiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
    if (!resetRequest) {
      throw invalidOtpError;
    }

    const otpMatches = await bcrypt.compare(dto.otp, resetRequest.otpHash);
    if (!otpMatches) {
      // Count the miss, and burn the request outright once the cap is hit —
      // otherwise the 10-minute window allows unlimited guesses against a
      // 10^6 keyspace. Same generic error either way, so a burned request
      // is indistinguishable from a wrong guess.
      resetRequest.otpAttemptCount = (resetRequest.otpAttemptCount ?? 0) + 1;
      if (resetRequest.otpAttemptCount >= MAX_OTP_ATTEMPTS) {
        resetRequest.consumedAt = new Date();
      }
      await this.passwordResetRequestRepository.save(resetRequest);
      throw invalidOtpError;
    }

    const resetToken = randomBytes(32).toString('hex');
    resetRequest.verifiedAt = new Date();
    resetRequest.resetTokenHash = hashToken(resetToken);
    resetRequest.resetTokenExpiresAt = minutesFromNow(
      RESET_TOKEN_VALIDITY_MINUTES,
    );
    await this.passwordResetRequestRepository.save(resetRequest);

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const resetTokenHash = hashToken(dto.resetToken);
    const invalidTokenError = new BadRequestException(
      'Invalid or expired reset token',
    );
    const resetRequest = await this.passwordResetRequestRepository.findOne({
      where: {
        resetTokenHash,
        consumedAt: IsNull(),
        resetTokenExpiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (!resetRequest) {
      throw invalidTokenError;
    }

    const user = resetRequest.user;
    user.passwordHash = await this.hashPassword(dto.newPassword);
    user.lastPasswordResetAt = new Date();
    // Clearing the counter here is what makes the failed-login lockout
    // self-recoverable. Without it, anyone who knows a staff email could
    // permanently lock that account with `MAX_FAILED_LOGIN_ATTEMPTS + 1`
    // guesses, since nothing short of an SA/CA calling `UsersService.unlock`
    // ever reset it — including a successful password reset.
    user.failedLoginCount = 0;
    await this.userRepository.save(user);

    resetRequest.consumedAt = new Date();
    await this.passwordResetRequestRepository.save(resetRequest);
    await this.invalidateOutstandingResetRequests(user.id);
    await this.revokeAllRefreshTokensForUser(user.id);
  }

  applyAuthCookies(res: Response, tokens: TokenPair): void {
    // Secure-by-default: only an explicit `COOKIE_SECURE=false` (which
    // `.env.example` sets, for local http development) turns it off. The
    // previous default was the other way round, so any deployment that
    // simply never set the variable shipped session cookies over cleartext
    // http — a forgotten env var should fail safe, not silently insecure.
    const secure =
      this.configService.get<string>('COOKIE_SECURE', 'true') !== 'false';
    const accessMaxAge =
      this.configService.get<number>('JWT_ACCESS_EXPIRES_IN_SECONDS', 900) *
      1000;
    const refreshMaxAge =
      this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS', 86_400) *
      1000;

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: accessMaxAge,
    });
    // `strict` rather than `lax` for the refresh cookie specifically: it is
    // only ever sent to POST /api/v1/auth/refresh-token by the app's own XHR,
    // never carried on a top-level navigation, so nothing legitimate needs
    // the cross-site relaxation `lax` grants. The access cookie stays `lax`
    // because it is scoped to `/` and a strict setting there would drop the
    // session on any inbound link into the app.
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: refreshMaxAge,
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_TOKEN_COOKIE_PATH });
  }

  private async getRoleCodesForUser(userId: number): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { user: { id: userId }, isActive: true, isDeleted: false },
      relations: { roleType: true },
    });
    return userRoles.map((userRole) => userRole.roleType.code);
  }

  private async issueTokenPair(
    user: User,
    roles: string[],
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshTokenPlain = randomBytes(40).toString('hex');
    const refreshTokenTtlSeconds = this.configService.get<number>(
      'JWT_REFRESH_EXPIRES_IN_SECONDS',
      604_800,
    );
    const refreshToken = this.refreshTokenRepository.create({
      user,
      tokenHash: hashToken(refreshTokenPlain),
      expiresAt: new Date(Date.now() + refreshTokenTtlSeconds * 1000),
    });
    await this.refreshTokenRepository.save(refreshToken);

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  /**
   * A presented-but-already-revoked refresh token means the token was
   * replayed. Look up who it belonged to and revoke every live token they
   * hold. A token we've never seen at all (`null`) is just noise — nothing
   * to revoke.
   */
  private async revokeFamilyOnReuse(tokenHash: string): Promise<void> {
    const replayed = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });
    if (!replayed?.user) {
      return;
    }
    this.logger.warn(
      `Refresh token reuse detected for user ${replayed.user.id} — revoking all of their refresh tokens`,
    );
    await this.revokeAllRefreshTokensForUser(replayed.user.id);
  }

  /** Marks every still-live reset request for a user as consumed, so only
   * the newest OTP is ever valid. */
  private async invalidateOutstandingResetRequests(
    userId: number,
  ): Promise<void> {
    await this.passwordResetRequestRepository.update(
      { user: { id: userId }, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
  }

  private async revokeAllRefreshTokensForUser(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async recordActivity(
    user: User,
    activityType: UserActivityType,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    // Legacy stored a parsed platform/browser alongside the raw agent
    // (CodeIgniter's user-agent library). Leaving them null made every row
    // this backend wrote show a blank Platform column in the activity log,
    // next to legacy rows that have one.
    const { platform, browser } = parseUserAgent(userAgent);
    const log = this.userActivityLogRepository.create({
      user,
      activityType,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      platform,
      browser,
      occurredAt: new Date(),
    });
    await this.userActivityLogRepository.save(log);
  }

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.getSaltRounds());
  }

  /**
   * Legacy `users.password` holds an MD5 digest, and this backend never reads
   * it: every legacy user sets a new password through the reset flow before
   * their first sign-in here. A null `passwordHash` therefore means "has not
   * migrated yet", not "wrong password".
   */
  private async verifyPassword(user: User, plain: string): Promise<boolean> {
    if (user.passwordHash === null) {
      throw new UnauthorizedException(PASSWORD_RESET_REQUIRED_MESSAGE);
    }
    return bcrypt.compare(plain, user.passwordHash);
  }

  private assertPasswordNotExpired(user: User): void {
    const expiryDays = Number(
      this.configService.get(
        'PASSWORD_EXPIRY_DAYS',
        DEFAULT_PASSWORD_EXPIRY_DAYS,
      ),
    );
    if (!user.lastPasswordResetAt) {
      throw new UnauthorizedException(PASSWORD_EXPIRED_MESSAGE);
    }
    const ageMs = Date.now() - user.lastPasswordResetAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays > expiryDays) {
      throw new UnauthorizedException(PASSWORD_EXPIRED_MESSAGE);
    }
  }

  private getSaltRounds(): number {
    // ConfigService doesn't cast env-var strings to numbers (the generic is
    // a type hint only) — bcrypt.hash() treats a string saltOrRounds as a
    // literal salt, not a cost factor, and throws. Number(...) is required.
    return Number(this.configService.get('BCRYPT_SALT_ROUNDS', 10));
  }

  private isUsableAccount(user: User | null): user is User {
    return !!user && user.isActive && !user.isDeleted;
  }
}

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

function toSafeUser(user: User, roles: string[]): SafeUser {
  return { id: user.id, name: user.name, email: user.email, roles };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `randomInt` (CSPRNG), NOT `Math.random()` — this OTP is the sole factor
 * guarding a password reset, and V8's `Math.random()` is a seeded xorshift
 * PRNG whose future output is recoverable from a handful of observed values.
 * `randomInt`'s upper bound is exclusive, so 100000..999999 inclusive. */
function generateNumericOtp(): string {
  return String(randomInt(100_000, 1_000_000));
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
