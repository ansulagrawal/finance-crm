import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CreditApplicationAllocationService } from './credit-application-allocation.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [CreditApplicationAllocationService],
})
export class CreditApplicationAllocationModule {}
