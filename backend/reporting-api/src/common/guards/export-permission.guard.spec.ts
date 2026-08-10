import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExportPermissionGuard } from './export-permission.guard';

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

describe('ExportPermissionGuard', () => {
  let reflector: Reflector;
  let exportPermissionRepository: { findOne: jest.Mock };
  let exportAccessLogRepository: { create: jest.Mock; save: jest.Mock };
  let guard: ExportPermissionGuard;

  beforeEach(() => {
    reflector = new Reflector();
    exportPermissionRepository = { findOne: jest.fn() };
    exportAccessLogRepository = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    guard = new ExportPermissionGuard(
      reflector,
      exportPermissionRepository as never,
      exportAccessLogRepository as never,
    );
  });

  it('allows the request through when the handler has no @RequireExportPermission metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
    expect(exportPermissionRepository.findOne).not.toHaveBeenCalled();
    expect(exportAccessLogRepository.save).not.toHaveBeenCalled();
  });

  it('allows SA/CA roles through without checking the permission table, but still logs access', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(10);
    const context = makeContext({ sub: 1, roles: ['SA'] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(exportPermissionRepository.findOne).not.toHaveBeenCalled();
    expect(exportAccessLogRepository.save).toHaveBeenCalled();
  });

  it('allows a non-admin user with an active grant for that export id', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(10);
    exportPermissionRepository.findOne.mockResolvedValue({ id: 1 });
    const context = makeContext({ sub: 42, roles: ['CO1'] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(exportPermissionRepository.findOne).toHaveBeenCalledWith({
      where: {
        user: { id: 42 },
        export: { id: 10 },
        isActive: true,
        isDeleted: false,
      },
    });
    expect(exportAccessLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        export: { id: 10 },
        user: { id: 42 },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    );
    expect(exportAccessLogRepository.save).toHaveBeenCalled();
  });

  it('rejects a non-admin user with no grant for that export id, without logging access', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(10);
    exportPermissionRepository.findOne.mockResolvedValue(null);
    const context = makeContext({ sub: 42, roles: ['CO1'] });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(exportAccessLogRepository.save).not.toHaveBeenCalled();
  });

  it('rejects when there is no authenticated user at all', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(10);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
