import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function contextWith(roles: string[] | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: roles ? { roles } : undefined }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as never;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith(['CO1']))).toBe(true);
  });

  it('allows a user holding one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => ['CR2', 'CR3'],
    } as never;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith(['CR2']))).toBe(true);
  });

  it('rejects a user holding none of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => ['CR2', 'CR3'],
    } as never;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWith(['CO1']))).toThrow(
      ForbiddenException,
    );
  });

  it('always lets SA/CA through, even when neither is in the required list', () => {
    const reflector = {
      getAllAndOverride: () => ['AM', 'AH'],
    } as never;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith(['SA']))).toBe(true);
    expect(guard.canActivate(contextWith(['CA']))).toBe(true);
  });

  it('rejects when there is no authenticated user at all', () => {
    const reflector = { getAllAndOverride: () => ['CR2'] } as never;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
