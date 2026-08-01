import { IntegrationsApiClientModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionModule } from '../collection/collection.module';
import { LeadEligibilityController } from './lead-eligibility.controller';
import { LeadEligibilityService } from './lead-eligibility.service';
import { LeadImportController } from './lead-import.controller';
import { LeadImportService } from './lead-import.service';
import { LeadLookupsController } from './lead-lookups.controller';
import { LeadLookupsService } from './lead-lookups.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [CommonModule, CollectionModule, IntegrationsApiClientModule],
  providers: [
    LeadsService,
    LeadLookupsService,
    LeadImportService,
    LeadEligibilityService,
  ],
  controllers: [
    LeadsController,
    LeadLookupsController,
    LeadImportController,
    LeadEligibilityController,
  ],
  exports: [LeadsService],
})
export class LeadsModule {}
