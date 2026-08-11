import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LeadRejectionService } from './lead-rejection.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [LeadRejectionService],
})
export class LeadRejectionModule {}
