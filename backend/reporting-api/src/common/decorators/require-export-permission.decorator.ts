import { SetMetadata } from '@nestjs/common';

export const EXPORT_PERMISSION_KEY = 'exportPermissionId';

/** See `require-mis-permission.decorator.ts` — same pattern, gates against
 * the legacy `master_export.export_id` via `ExportPermissionGuard`. */
export const RequireExportPermission = (legacyExportId: number) =>
  SetMetadata(EXPORT_PERMISSION_KEY, legacyExportId);
