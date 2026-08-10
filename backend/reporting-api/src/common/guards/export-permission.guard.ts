import type { AuthenticatedUser } from '@finance-crm/common';
import {
  ExportAccessLog,
  ExportCatalog,
  User,
  UserExportPermission,
} from '@finance-crm/database';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EXPORT_PERMISSION_KEY } from '../decorators/require-export-permission.decorator';

const ADMIN_ROLE_CODES = ['SA', 'CA'];

@Injectable()
export class ExportPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserExportPermission)
    private readonly exportPermissionRepository: Repository<UserExportPermission>,
    @InjectRepository(ExportAccessLog)
    private readonly exportAccessLogRepository: Repository<ExportAccessLog>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const legacyExportId = this.reflector.getAllAndOverride<number>(
      EXPORT_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (legacyExportId === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (!user.roles.some((role) => ADMIN_ROLE_CODES.includes(role))) {
      const grant = await this.exportPermissionRepository.findOne({
        where: {
          user: { id: user.sub },
          export: { id: legacyExportId },
          isActive: true,
          isDeleted: false,
        },
      });
      if (!grant) {
        throw new ForbiddenException(
          `You do not have permission to run this export (id ${legacyExportId})`,
        );
      }
    }

    await this.logAccess(legacyExportId, user, request);
    return true;
  }

  /**
   * Fires after access is granted (admin bypass or a real grant) — mirrors
   * legacy `export_access_logs`. Sets the export/user relations by id only
   * (both already validated above/by the JWT) to avoid an extra round trip
   * on every reporting request.
   *
   * `userRoleId` is left null: the real entity's `eal_user_role_id` refers
   * to a specific `user_roles` row id, but the JWT payload only carries
   * role *codes* (`AuthenticatedUser.roles: string[]`), not which
   * particular `UserRole` row the current session corresponds to — a user
   * with more than one active role has no way to disambiguate from the
   * JWT alone. Resolving it would mean an extra guess-prone lookup rather
   * than a genuine value; the column is nullable, so this is left unset
   * rather than guessed. `createdAt` is NOT NULL with no DB default (the
   * old code never set it) — set explicitly here.
   */
  private async logAccess(
    legacyExportId: number,
    user: AuthenticatedUser,
    request: {
      query?: Record<string, unknown>;
      ip?: string;
      headers?: Record<string, unknown>;
    },
  ): Promise<void> {
    const log = this.exportAccessLogRepository.create({
      export: { id: legacyExportId } as ExportCatalog,
      user: { id: user.sub } as User,
      startDate: (request.query?.startDate as string | undefined) ?? null,
      endDate: (request.query?.endDate as string | undefined) ?? null,
      ipAddress: request.ip ?? null,
      userAgent:
        (request.headers?.['user-agent'] as string | undefined) ?? null,
      createdAt: new Date(),
    });
    await this.exportAccessLogRepository.save(log);
  }
}
