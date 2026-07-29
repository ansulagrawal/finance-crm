import { User } from '@finance-crm/database';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { Repository } from 'typeorm';
import type { AccessTokenPayload } from './auth.types';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.constants';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // Pin the accepted algorithm set explicitly. jsonwebtoken infers
      // HS256/384/512 from a symmetric `secretOrKey` today, but that is an
      // implementation detail of the library's key-type sniffing, not a
      // guarantee — stating it here means a future key-format change can
      // never widen this to an asymmetric algorithm the secret would then
      // be verified against as a public key.
      algorithms: ['HS256'],
    });
  }

  /**
   * Signature verification alone only proves the token was minted by us; it
   * says nothing about whether the account still exists. Access tokens live
   * `JWT_ACCESS_EXPIRES_IN_SECONDS` (900s by default), and deactivating or
   * soft-deleting a user previously left their existing token fully usable
   * for the rest of that window — `revokeAllRefreshTokensForUser` only ever
   * covered refresh tokens. One primary-key lookup per request closes that.
   *
   * Roles still come from the token payload, so a role change takes effect
   * on the next refresh rather than the next request — that remains a
   * deliberate trade (see `SharedAuthModule`), and it is a much smaller
   * exposure than a deactivated account continuing to work.
   */
  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: { id: true, isActive: true, isDeleted: true },
    });
    if (!user?.isActive || user.isDeleted) {
      throw new UnauthorizedException('Account is no longer active');
    }
    return payload;
  }
}
