import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * `SA`/`CA` always pass any `@Roles(...)` check, on top of whatever roles
 * the decorator actually lists — matches legacy's own universal
 * `$label == 'X' || $label == 'CA' || $label == 'SA'` pattern (see
 * `LeadsService`'s self-allocate rules, ported from that exact check) and
 * the client's own role documentation: Client Admin (`CA`) "can perform
 * all actions available to every other role in the system." A handler
 * that genuinely should be admin-only still expresses that correctly as
 * `@Roles('SA', 'CA')` — everyone else gets rejected, admins pass via
 * either path.
 */
const ADMIN_OVERRIDE_ROLES = ['SA', 'CA'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    const hasRequiredRole = Boolean(
      user?.roles?.some(
        (role) =>
          requiredRoles.includes(role) || ADMIN_OVERRIDE_ROLES.includes(role),
      ),
    );
    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role to perform this action');
    }
    return true;
  }
}
