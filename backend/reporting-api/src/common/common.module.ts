import { ALL_ENTITIES } from '@finance-crm/database/all-entities';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportPermissionGuard } from './guards/export-permission.guard';
import { MisPermissionGuard } from './guards/mis-permission.guard';

/**
 * Registers every entity in the schema. MIS reports and CSV exports
 * legitimately cut across nearly every domain (a single report can join
 * leads, CAM, BRE, disbursal, collection, verification, users, geography),
 * so curating a per-report entity list here would just re-create the same
 * "Entity metadata for X was not found" boot crash `integrations-api` hit
 * repeatedly. Every report/export module imports this instead of
 * registering entities piecemeal.
 *
 * Also registers `MisPermissionGuard`/`ExportPermissionGuard` globally —
 * both no-op unless a handler carries `@RequireMisPermission`/
 * `@RequireExportPermission` metadata, same pattern as `RolesGuard` in
 * `@finance-crm/common`.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  providers: [
    { provide: APP_GUARD, useClass: MisPermissionGuard },
    { provide: APP_GUARD, useClass: ExportPermissionGuard },
  ],
  exports: [TypeOrmModule],
})
export class CommonModule {}
