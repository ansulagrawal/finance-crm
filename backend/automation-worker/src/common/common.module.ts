import { ALL_ENTITIES } from '@finance-crm/database/all-entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Cron jobs cut across nearly every domain (leads, CAM, disbursal,
 * collection, verification), so - same rationale as core-api's/
 * integrations-api's CommonModule - registers the full entity set once
 * via ALL_ENTITIES rather than each job module hand-picking a subset and
 * risking the "Entity metadata not found" boot crash documented in the
 * root CLAUDE.md.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  exports: [TypeOrmModule],
})
export class CommonModule {}
