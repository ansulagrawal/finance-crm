import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_TIMESTAMP_HEADER,
  verifyInternalSignature,
} from '../internal-service-auth.util';

type RequestWithInternalAuth = Request & {
  rawBody?: Buffer;
  user?: AuthenticatedUser;
};

/**
 * `request.user` for a request authenticated via the internal HMAC path
 * (`internal-service-auth.util.ts`) rather than a real staff session — the
 * two services that call another service internally (`core-api`,
 * `automation-worker` calling `integrations-api`) act on behalf of the
 * system, not a specific logged-in user. Deliberately **not** added to
 * `RolesGuard`'s `SA`/`CA` admin-override list — a route that later gains
 * `@Roles(...)` should reject an internal caller by default, not silently
 * inherit admin rights just because this identity exists.
 */
const INTERNAL_SERVICE_USER: AuthenticatedUser = {
  sub: 0,
  email: 'system@internal',
  roles: ['SYSTEM'],
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithInternalAuth>();
    const signature = request.headers[INTERNAL_SIGNATURE_HEADER] as
      | string
      | undefined;
    if (signature) {
      return this.verifyInternalRequest(request, signature);
    }

    return super.canActivate(context);
  }

  /**
   * Presence of `x-internal-signature` means the caller intended this as a
   * service-to-service request — verify it outright rather than silently
   * falling through to the cookie-JWT path (which would just fail anyway,
   * a real internal caller never carries a cookie, but a clear rejection
   * here is far easier to debug than a generic "no session" 401).
   */
  private verifyInternalRequest(
    request: RequestWithInternalAuth,
    signature: string,
  ): boolean {
    const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    if (!secret) {
      // Fail closed, not a 500 - e.g. reporting-api, which is never a
      // real receiver, may legitimately have no secret configured at all.
      throw new UnauthorizedException(
        'Internal service authentication is not configured',
      );
    }
    const timestamp = request.headers[INTERNAL_TIMESTAMP_HEADER] as
      | string
      | undefined;
    const verified = verifyInternalSignature(
      request.method,
      request.path,
      request.rawBody ?? Buffer.alloc(0),
      secret,
      signature,
      timestamp,
    );
    if (!verified) {
      throw new UnauthorizedException('Invalid internal service signature');
    }
    request.user = INTERNAL_SERVICE_USER;
    return true;
  }
}
