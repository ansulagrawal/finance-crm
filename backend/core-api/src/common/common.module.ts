import { ALL_ENTITIES } from '@finance-crm/database/all-entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * core-api's own domain scope (leads/CAM/BRE/disbursal/collection/
 * verification/feedback/users/company/geography/audit/menu-permissions/
 * search) already touches nearly every entity's relation graph, so
 * curating a manual subset per `docs/SCHEMA-MAP.md` entity (as
 * integrations-api/reporting-api do, since their scope is narrower) would
 * just re-derive `ALL_ENTITIES` piecemeal and risk the exact
 * "Entity metadata for X#y was not found" boot crash this pattern exists
 * to prevent. Every feature module imports this instead of registering
 * entities itself.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  exports: [TypeOrmModule],
})
export class CommonModule {}
