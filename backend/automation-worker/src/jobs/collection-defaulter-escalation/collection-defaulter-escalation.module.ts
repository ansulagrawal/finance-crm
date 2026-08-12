import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CollectionDefaulterEscalationService } from './collection-defaulter-escalation.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [CollectionDefaulterEscalationService],
})
export class CollectionDefaulterEscalationModule {}
