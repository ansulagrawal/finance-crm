import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { NotContactableLeadSmsService } from './not-contactable-lead-sms.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [NotContactableLeadSmsService],
})
export class NotContactableLeadSmsModule {}
