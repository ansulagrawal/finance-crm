import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { AllocateLeadsAndApplicationService } from './allocate-leads-and-application.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [AllocateLeadsAndApplicationService],
})
export class AllocateLeadsAndApplicationModule {}
