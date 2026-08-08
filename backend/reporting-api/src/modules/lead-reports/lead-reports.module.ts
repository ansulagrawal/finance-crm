import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LeadReportsController } from './lead-reports.controller';
import { LeadReportsService } from './lead-reports.service';

@Module({
  imports: [CommonModule],
  controllers: [LeadReportsController],
  providers: [LeadReportsService],
})
export class LeadReportsModule {}
