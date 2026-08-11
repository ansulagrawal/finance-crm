import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RepeatOnlineCustomersAllocationService } from './repeat-online-customers-allocation.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [RepeatOnlineCustomersAllocationService],
})
export class RepeatOnlineCustomersAllocationModule {}
