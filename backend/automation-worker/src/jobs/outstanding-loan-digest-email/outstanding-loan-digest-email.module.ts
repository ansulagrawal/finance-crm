import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { OutstandingLoanDigestEmailService } from './outstanding-loan-digest-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [OutstandingLoanDigestEmailService],
})
export class OutstandingLoanDigestEmailModule {}
