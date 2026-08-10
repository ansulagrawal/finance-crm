import type { AuthenticatedUser } from '@finance-crm/common';
import {
  MisAccessLog,
  MisReportCatalog,
  User,
  UserMisPermission,
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
import { MIS_PERMISSION_KEY } from '../decorators/require-mis-permission.decorator';

const ADMIN_ROLE_CODES = ['SA', 'CA'];

@Injectable()
export class MisPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserMisPermission)
    private readonly misPermissionRepository: Repository<UserMisPermission>,
    @InjectRepository(MisAccessLog)
    private readonly misAccessLogRepository: Repository<MisAccessLog>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const legacyReportId = this.reflector.getAllAndOverride<number>(
      MIS_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (legacyReportId === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (!user.roles.some((role) => ADMIN_ROLE_CODES.includes(role))) {
      const grant = await this.misPermissionRepository.findOne({
        where: {
          user: { id: user.sub },
          mis: { id: legacyReportId },
          isActive: true,
          isDeleted: false,
        },
      });
      if (!grant) {
        throw new ForbiddenException(
          `You do not have permission to run this report (id ${legacyReportId})`,
        );
      }
    }

    await this.logAccess(legacyReportId, user, request);
    return true;
  }

  /**
   * Fires after access is granted (admin bypass or a real grant) — mirrors
   * legacy `mis_access_logs`. Sets the report/user relations by id only
   * (both already validated above/by the JWT) to avoid an extra round trip
   * on every reporting request.
   *
   * `userRoleId` is left null — same reasoning as
   * `ExportPermissionGuard.logAccess()`: the JWT only carries role codes,
   * not which specific `UserRole` row the session corresponds to.
   * `createdAt` is NOT NULL with no DB default (the old code never set
   * it) — set explicitly here.
   */
  private async logAccess(
    legacyReportId: number,
    user: AuthenticatedUser,
    request: {
      query?: Record<string, unknown>;
      ip?: string;
      headers?: Record<string, unknown>;
    },
  ): Promise<void> {
    const log = this.misAccessLogRepository.create({
      mis: { id: legacyReportId } as MisReportCatalog,
      user: { id: user.sub } as User,
      startDate: (request.query?.startDate as string | undefined) ?? null,
      endDate: (request.query?.endDate as string | undefined) ?? null,
      ipAddress: request.ip ?? null,
      userAgent:
        (request.headers?.['user-agent'] as string | undefined) ?? null,
      createdAt: new Date(),
    });
    await this.misAccessLogRepository.save(log);
  }
}
