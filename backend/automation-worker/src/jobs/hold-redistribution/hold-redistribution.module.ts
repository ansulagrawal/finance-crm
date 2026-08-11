import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ApplicationHoldRedistributionService } from './application-hold-redistribution.service';
import { LeadHoldRedistributionService } from './lead-hold-redistribution.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [
    LeadHoldRedistributionService,
    ApplicationHoldRedistributionService,
  ],
})
export class HoldRedistributionModule {}
