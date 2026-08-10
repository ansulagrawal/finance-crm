import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MisPermissionGuard } from './mis-permission.guard';

function makeContext(
  user: unknown,
  requestOverrides: Record<string, unknown> = {},
) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        query: {},
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        ...requestOverrides,
      }),
    }),
  } as never;
}

describe('MisPermissionGuard', () => {
  let reflector: Reflector;
  let misPermissionRepository: { findOne: jest.Mock };
  let misAccessLogRepository: { create: jest.Mock; save: jest.Mock };
  let guard: MisPermissionGuard;

  beforeEach(() => {
    reflector = new Reflector();
    misPermissionRepository = { findOne: jest.fn() };
    misAccessLogRepository = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    guard = new MisPermissionGuard(
      reflector,
      misPermissionRepository as never,
      misAccessLogRepository as never,
    );
  });

  it('allows the request through when the handler has no @RequireMisPermission metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
    expect(misPermissionRepository.findOne).not.toHaveBeenCalled();
    expect(misAccessLogRepository.save).not.toHaveBeenCalled();
  });

  it('allows SA/CA roles through without checking the permission table, but still logs access', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(75);
    const context = makeContext({ sub: 1, roles: ['SA'] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(misPermissionRepository.findOne).not.toHaveBeenCalled();
    expect(misAccessLogRepository.save).toHaveBeenCalled();
  });

  it('allows a non-admin user with an active grant for that report id', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(75);
    misPermissionRepository.findOne.mockResolvedValue({ id: 1 });
    const context = makeContext({ sub: 42, roles: ['CR1'] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(misPermissionRepository.findOne).toHaveBeenCalledWith({
      where: {
        user: { id: 42 },
        mis: { id: 75 },
        isActive: true,
        isDeleted: false,
      },
    });
    expect(misAccessLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mis: { id: 75 },
        user: { id: 42 },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    );
    expect(misAccessLogRepository.save).toHaveBeenCalled();
  });

  it('rejects a non-admin user with no grant for that report id, without logging access', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(75);
    misPermissionRepository.findOne.mockResolvedValue(null);
    const context = makeContext({ sub: 42, roles: ['CR1'] });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(misAccessLogRepository.save).not.toHaveBeenCalled();
  });

  it('rejects when there is no authenticated user at all', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(75);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
