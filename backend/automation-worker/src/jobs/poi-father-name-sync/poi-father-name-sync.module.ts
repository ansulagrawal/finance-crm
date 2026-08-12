import { JobRunnerModule } from '@finance-crm/common';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PoiFatherNameSyncService } from './poi-father-name-sync.service';

@Module({
  imports: [CommonModule, JobRunnerModule],
  providers: [PoiFatherNameSyncService],
})
export class PoiFatherNameSyncModule {}
