import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RepaymentReminderEmailService } from './repayment-reminder-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [RepaymentReminderEmailService],
})
export class RepaymentReminderEmailModule {}
