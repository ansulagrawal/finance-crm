import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RepaymentReminderSmsService } from './repayment-reminder-sms.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [RepaymentReminderSmsService],
})
export class RepaymentReminderSmsModule {}
