import { SetMetadata } from '@nestjs/common';

export const MIS_PERMISSION_KEY = 'misPermissionId';

/**
 * Gates a report endpoint behind the real legacy `master_mis_report.report_id`
 * (or `master_export.export_id` for `RequireExportPermission`) via
 * `MisPermissionGuard`/`ExportPermissionGuard`. Legacy has this exact
 * permission model (`user_mis_permission`/`user_export_permission`) but its
 * dispatcher's checks are commented out — every user can run every report
 * today. This port actually enforces it — a real security fix, not a port
 * of existing behavior.
 */
export const RequireMisPermission = (legacyReportId: number) =>
  SetMetadata(MIS_PERMISSION_KEY, legacyReportId);
