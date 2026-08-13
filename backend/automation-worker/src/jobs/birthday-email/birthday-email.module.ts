import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BirthdayEmailService } from './birthday-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [BirthdayEmailService],
})
export class BirthdayEmailModule {}
