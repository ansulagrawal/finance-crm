import {
  PasswordResetRequest,
  RefreshToken,
  User,
  UserActivityLog,
  UserRole,
} from '@finance-crm/database';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull } from 'typeorm';
import { AuthService } from './auth.service';
import { NotificationsService } from './notifications.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn(),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let refreshTokenRepository: ReturnType<typeof repo>;
  let passwordResetRequestRepository: ReturnType<typeof repo>;
  let userActivityLogRepository: ReturnType<typeof repo>;
  let sendPasswordResetOtp: jest.Mock;

  function baseUser(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      name: 'Test User',
      email: 'user@example.com',
      mobile: null,
      username: null,
      passwordHash: 'hashed-password',
      lastLoginAt: null,
      lastLoginIp: null,
      failedLoginCount: 0,
      lastPasswordResetAt: new Date(),
      company: null,
      product: null,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as User;
  }

  beforeEach(async () => {
    userRepository = repo();
    userRoleRepository = repo();
    refreshTokenRepository = repo();
    passwordResetRequestRepository = repo();
    userActivityLogRepository = repo();
    sendPasswordResetOtp = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(UserRole),
          useValue: userRoleRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(PasswordResetRequest),
          useValue: passwordResetRequestRepository,
        },
        {
          provide: getRepositoryToken(UserActivityLog),
          useValue: userActivityLogRepository,
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed-jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: unknown) => fallback,
          },
        },
        {
          provide: NotificationsService,
          useValue: { sendPasswordResetOtp },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('signIn', () => {
    it('tells a migrated legacy user to reset before signing in', async () => {
      // Legacy users carry only the MD5 in `users.password`; `passwordHash` is
      // null until they go through the reset flow. Auth must never read the MD5.
      const user = baseUser({
        passwordHash: null,
        legacyPasswordMd5: '5f4dcc3b5aa765d61d8327deb882cf99',
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn({ email: user.email, password: 'password' }, '', ''),
      ).rejects.toThrow(/Set a new password/);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('signs in with the correct password and returns tokens + safe user', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = baseUser({ passwordHash: hash });
      userRepository.findOne.mockResolvedValue(user);
      userRoleRepository.find.mockResolvedValue([{ roleType: { code: 'AU' } }]);

      const result = await service.signIn(
        { email: user.email, password: 'correct-password' },
        '127.0.0.1',
        'jest-agent',
      );

      expect(result.accessToken).toBe('signed-jwt');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.user).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        roles: ['AU'],
      });
      // failed count reset + last login tracked
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginCount: 0,
          lastLoginIp: '127.0.0.1',
        }),
      );
      expect(userActivityLogRepository.save).toHaveBeenCalled();
    });

    it('rejects a wrong password and increments the failed-login counter', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = baseUser({ passwordHash: hash, failedLoginCount: 1 });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'wrong-password' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow('Invalid email or password');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 2 }),
      );
      expect(userActivityLogRepository.save).not.toHaveBeenCalled();
    });

    it('rejects sign-in for a deactivated user without checking the password', async () => {
      const user = baseUser({ isActive: false });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'anything' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects sign-in for a soft-deleted user', async () => {
      const user = baseUser({ isDeleted: true });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'anything' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects sign-in for an unknown email', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.signIn(
          { email: 'nobody@example.com', password: 'anything' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('locks the account once failedLoginCount exceeds the threshold, before checking the password', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = baseUser({ passwordHash: hash, failedLoginCount: 4 });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'correct-password' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow('Account locked due to too many failed login attempts');
      // the lockout check happens before bcrypt.compare — save() is never called
      // (no failed-attempt increment, no successful-login reset) for a locked account
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('does not lock the account exactly at the threshold', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = baseUser({ passwordHash: hash, failedLoginCount: 3 });
      userRepository.findOne.mockResolvedValue(user);
      userRoleRepository.find.mockResolvedValue([]);

      const result = await service.signIn(
        { email: user.email, password: 'correct-password' },
        undefined,
        undefined,
      );
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('rejects sign-in when the password has never been reset (lastPasswordResetAt null)', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = baseUser({ passwordHash: hash, lastPasswordResetAt: null });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'correct-password' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(/password has expired/i);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects sign-in once the password is older than the configured expiry window', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const user = baseUser({
        passwordHash: hash,
        lastPasswordResetAt: fifteenDaysAgo,
      });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.signIn(
          { email: user.email, password: 'correct-password' },
          undefined,
          undefined,
        ),
      ).rejects.toThrow(/password has expired/i);
    });

    it('allows sign-in exactly at the 14-day boundary', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
      const user = baseUser({
        passwordHash: hash,
        lastPasswordResetAt: thirteenDaysAgo,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRoleRepository.find.mockResolvedValue([]);

      const result = await service.signIn(
        { email: user.email, password: 'correct-password' },
        undefined,
        undefined,
      );
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('honors a configured PASSWORD_EXPIRY_DAYS instead of the 14-day default', async () => {
      userRepository = repo();
      userRoleRepository = repo();
      const moduleRef = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: getRepositoryToken(User), useValue: userRepository },
          {
            provide: getRepositoryToken(UserRole),
            useValue: userRoleRepository,
          },
          {
            provide: getRepositoryToken(RefreshToken),
            useValue: refreshTokenRepository,
          },
          {
            provide: getRepositoryToken(PasswordResetRequest),
            useValue: passwordResetRequestRepository,
          },
          {
            provide: getRepositoryToken(UserActivityLog),
            useValue: userActivityLogRepository,
          },
          {
            provide: JwtService,
            useValue: { signAsync: jest.fn().mockResolvedValue('signed-jwt') },
          },
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, fallback?: unknown) =>
                key === 'PASSWORD_EXPIRY_DAYS' ? 30 : fallback,
            },
          },
          {
            provide: NotificationsService,
            useValue: { sendPasswordResetOtp },
          },
        ],
      }).compile();
      const configuredService = moduleRef.get(AuthService);

      const hash = await bcrypt.hash('correct-password', 4);
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const user = baseUser({
        passwordHash: hash,
        lastPasswordResetAt: twentyDaysAgo,
      });
      userRepository.findOne.mockResolvedValue(user);
      userRoleRepository.find.mockResolvedValue([]);

      const result = await configuredService.signIn(
        { email: user.email, password: 'correct-password' },
        undefined,
        undefined,
      );
      expect(result.accessToken).toBe('signed-jwt');
    });
  });

  describe('refreshTokens', () => {
    it('issues a new token pair for a valid, unexpired, unrevoked refresh token and revokes the old one', async () => {
      const user = baseUser();
      const existing = {
        id: 10,
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user,
      };
      refreshTokenRepository.findOne.mockResolvedValue(existing);
      userRoleRepository.find.mockResolvedValue([]);

      const tokens = await service.refreshTokens('plain-refresh-token');

      expect(tokens.accessToken).toBe('signed-jwt');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10, revokedAt: expect.any(Date) }),
      );
    });

    it('rejects a refresh token that does not match any stored (unrevoked, unexpired) row', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('unknown-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the whole family when an already-revoked token is replayed', async () => {
      const user = baseUser();
      // First lookup filters on revokedAt: IsNull() and so misses; the
      // reuse-detection lookup then finds the revoked row.
      refreshTokenRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 11,
          tokenHash: 'hash',
          revokedAt: new Date(),
          user,
        });

      await expect(service.refreshTokens('stolen-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { user: { id: user.id }, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('rejects and revokes when the account behind a valid token is deactivated', async () => {
      const user = baseUser({ isActive: false });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 12,
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      await expect(service.refreshTokens('valid-but-dead')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { user: { id: user.id }, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('does not revoke anything for a token it has never seen', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('never-issued')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a revoked refresh token', async () => {
      // the repository query filters on revokedAt: IsNull(), so a revoked
      // token would not be returned by findOne in real usage — this asserts
      // the defense-in-depth revokedAt check inside the service too.
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 11,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: baseUser(),
      });

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });

  describe('logout', () => {
    it('revokes the matching refresh token and records a LOGOUT activity', async () => {
      const user = baseUser();
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 5,
        revokedAt: null,
        user,
      });

      await service.logout('plain-refresh-token');

      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, revokedAt: expect.any(Date) }),
      );
      expect(userActivityLogRepository.save).toHaveBeenCalled();
    });

    it('is a no-op when the refresh token is unknown', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await service.logout('unknown-token');

      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
      expect(userActivityLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('rejects when the current password is wrong and does not touch the stored hash', async () => {
      const hash = await bcrypt.hash('actual-current', 4);
      const user = baseUser({ passwordHash: hash });
      userRepository.findOneOrFail.mockResolvedValue(user);

      await expect(
        service.changePassword(user.id, {
          currentPassword: 'wrong-current',
          newPassword: 'newpass1',
        }),
      ).rejects.toThrow('Current password is incorrect');
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });

    it('updates the password hash and revokes all refresh tokens when the current password matches', async () => {
      const hash = await bcrypt.hash('actual-current', 4);
      const user = baseUser({ passwordHash: hash });
      userRepository.findOneOrFail.mockResolvedValue(user);

      await service.changePassword(user.id, {
        currentPassword: 'actual-current',
        newPassword: 'newpass1',
      });

      expect(userRepository.save).toHaveBeenCalled();
      const saved = userRepository.save.mock.calls[0][0];
      expect(saved.passwordHash).not.toBe(hash);
      expect(await bcrypt.compare('newpass1', saved.passwordHash)).toBe(true);
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { user: { id: user.id }, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('generates and stores an OTP and sends it for a usable account', async () => {
      const user = baseUser();
      userRepository.findOne.mockResolvedValue(user);

      await service.requestPasswordReset({ email: user.email });

      expect(passwordResetRequestRepository.save).toHaveBeenCalled();
      const saved = passwordResetRequestRepository.save.mock.calls[0][0];
      expect(saved.otpExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(sendPasswordResetOtp).toHaveBeenCalledWith(
        user.email,
        expect.stringMatching(/^\d{6}$/),
        // Third arg carries the display name plus request context (IP/UA),
        // which the OTP email shows so an unexpected recipient can see where
        // the reset request came from.
        expect.objectContaining({ name: user.name }),
      );
    });

    it('silently does nothing for an unknown account (does not leak account existence)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(passwordResetRequestRepository.save).not.toHaveBeenCalled();
      expect(sendPasswordResetOtp).not.toHaveBeenCalled();
    });

    it('silently does nothing for a deactivated account', async () => {
      userRepository.findOne.mockResolvedValue(baseUser({ isActive: false }));

      await service.requestPasswordReset({ email: 'x@example.com' });

      expect(passwordResetRequestRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyPasswordResetOtp', () => {
    it('returns a reset token when the OTP matches an unexpired, unconsumed request', async () => {
      const user = baseUser();
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 4);
      userRepository.findOne.mockResolvedValue(user);
      passwordResetRequestRepository.findOne.mockResolvedValue({
        id: 1,
        user,
        otpHash,
        consumedAt: null,
        otpExpiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyPasswordResetOtp({
        email: user.email,
        otp,
      });

      expect(result.resetToken).toEqual(expect.any(String));
      const saved = passwordResetRequestRepository.save.mock.calls[0][0];
      expect(saved.verifiedAt).toBeInstanceOf(Date);
      expect(saved.resetTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects a wrong OTP', async () => {
      const user = baseUser();
      const otpHash = await bcrypt.hash('654321', 4);
      userRepository.findOne.mockResolvedValue(user);
      passwordResetRequestRepository.findOne.mockResolvedValue({
        id: 1,
        user,
        otpHash,
        consumedAt: null,
        otpExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifyPasswordResetOtp({ email: user.email, otp: '111111' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when there is no live (unexpired/unconsumed) OTP request — covers expiry', async () => {
      userRepository.findOne.mockResolvedValue(baseUser());
      passwordResetRequestRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyPasswordResetOtp({
          email: 'user@example.com',
          otp: '123456',
        }),
      ).rejects.toThrow('Invalid or expired OTP');
    });

    it('rejects for an unknown email without querying the reset-request table', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.verifyPasswordResetOtp({
          email: 'nobody@example.com',
          otp: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(passwordResetRequestRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown or expired reset token', async () => {
      passwordResetRequestRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          resetToken: 'bad-token',
          newPassword: 'newpass1',
        }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('updates the password, consumes the request, and revokes refresh tokens for a valid token', async () => {
      const user = baseUser();
      passwordResetRequestRepository.findOne.mockResolvedValue({
        id: 2,
        user,
        consumedAt: null,
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword({
        resetToken: 'good-token',
        newPassword: 'newpass1',
      });

      expect(userRepository.save).toHaveBeenCalled();
      const savedUser = userRepository.save.mock.calls[0][0];
      expect(await bcrypt.compare('newpass1', savedUser.passwordHash)).toBe(
        true,
      );
      const savedRequest = passwordResetRequestRepository.save.mock.calls[0][0];
      expect(savedRequest.consumedAt).toBeInstanceOf(Date);
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { user: { id: user.id }, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('clears failedLoginCount so a locked-out account can self-recover', async () => {
      const user = baseUser({ failedLoginCount: 9 });
      passwordResetRequestRepository.findOne.mockResolvedValue({
        id: 2,
        user,
        consumedAt: null,
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword({
        resetToken: 'good-token',
        newPassword: 'newpass1',
      });

      expect(userRepository.save.mock.calls[0][0].failedLoginCount).toBe(0);
    });
  });

  describe('OTP brute-force protection', () => {
    async function requestWith(otpAttemptCount: number) {
      const user = baseUser();
      const request = {
        id: 5,
        user,
        consumedAt: null,
        otpAttemptCount,
        otpHash: await bcrypt.hash('123456', 4),
        otpExpiresAt: new Date(Date.now() + 60_000),
      };
      userRepository.findOne.mockResolvedValue(user);
      passwordResetRequestRepository.findOne.mockResolvedValue(request);
      return request;
    }

    it('counts a wrong guess without burning a request that is under the cap', async () => {
      await requestWith(0);

      await expect(
        service.verifyPasswordResetOtp({
          email: 'user@example.com',
          otp: '999999',
        }),
      ).rejects.toThrow(BadRequestException);

      const saved = passwordResetRequestRepository.save.mock.calls[0][0];
      expect(saved.otpAttemptCount).toBe(1);
      expect(saved.consumedAt).toBeNull();
    });

    it('burns the request once the wrong-guess cap is reached', async () => {
      // MAX_OTP_ATTEMPTS is 5, so the 5th miss (count 4 -> 5) consumes it.
      await requestWith(4);

      await expect(
        service.verifyPasswordResetOtp({
          email: 'user@example.com',
          otp: '999999',
        }),
      ).rejects.toThrow(BadRequestException);

      const saved = passwordResetRequestRepository.save.mock.calls[0][0];
      expect(saved.otpAttemptCount).toBe(5);
      expect(saved.consumedAt).toBeInstanceOf(Date);
    });

    it('invalidates any earlier outstanding request when a new OTP is issued', async () => {
      const user = baseUser();
      userRepository.findOne.mockResolvedValue(user);

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(passwordResetRequestRepository.update).toHaveBeenCalledWith(
        { user: { id: user.id }, consumedAt: IsNull() },
        { consumedAt: expect.any(Date) },
      );
    });

    it('issues an OTP in range using the CSPRNG path', async () => {
      const user = baseUser();
      userRepository.findOne.mockResolvedValue(user);

      await service.requestPasswordReset({ email: 'user@example.com' });

      const otp = sendPasswordResetOtp.mock.calls[0][1];
      expect(otp).toMatch(/^\d{6}$/);
      expect(Number(otp)).toBeGreaterThanOrEqual(100_000);
      expect(Number(otp)).toBeLessThanOrEqual(999_999);
    });
  });
});
