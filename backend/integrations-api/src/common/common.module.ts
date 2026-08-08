import { ALL_ENTITIES } from '@finance-crm/database/all-entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorApiCacheService } from './vendor-api-cache.service';

/**
 * Registers `ALL_ENTITIES` rather than a manually curated subset (unlike
 * `backend/old/integrations-api`'s version) — with ~30 independent vendor
 * modules touching a wide, overlapping slice of the relation graph
 * (Lead/User/Company/Product/geography/CifCustomer/LeadCustomer plus every
 * vendor's own log entity), curating a subset by hand is exactly the kind
 * of thing that causes the "Entity metadata for X#y was not found" boot
 * crash — same reasoning as `core-api`'s `CommonModule`. Every vendor
 * module imports this instead of registering entities itself.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  providers: [VendorApiCacheService],
  exports: [TypeOrmModule, VendorApiCacheService],
})
export class CommonModule {}
