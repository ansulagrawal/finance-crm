import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ScreenerAllocationService } from './screener-allocation.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [ScreenerAllocationService],
})
export class ScreenerAllocationModule {}
