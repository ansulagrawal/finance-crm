import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LoanOutstandingRecomputeService } from './loan-outstanding-recompute.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [LoanOutstandingRecomputeService],
})
export class LoanOutstandingRecomputeModule {}
