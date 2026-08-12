import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { NotContactableLeadEmailService } from './not-contactable-lead-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [NotContactableLeadEmailService],
})
export class NotContactableLeadEmailModule {}
