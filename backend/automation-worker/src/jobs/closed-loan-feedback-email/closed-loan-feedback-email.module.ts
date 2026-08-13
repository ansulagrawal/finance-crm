import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ClosedLoanFeedbackEmailService } from './closed-loan-feedback-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [ClosedLoanFeedbackEmailService],
})
export class ClosedLoanFeedbackEmailModule {}
