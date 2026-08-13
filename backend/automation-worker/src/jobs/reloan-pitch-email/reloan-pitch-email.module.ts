import { IntegrationsApiClientModule, JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { ReloanPitchEmailService } from './reloan-pitch-email.service';

@Module({
  imports: [CommonModule, JobRunnerModule, IntegrationsApiClientModule],
  providers: [ReloanPitchEmailService],
})
export class ReloanPitchEmailModule {}
