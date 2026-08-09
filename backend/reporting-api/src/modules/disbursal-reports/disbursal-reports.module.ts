import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DisbursalReportsController } from './disbursal-reports.controller';
import { DisbursalReportsService } from './disbursal-reports.service';

@Module({
  imports: [CommonModule],
  controllers: [DisbursalReportsController],
  providers: [DisbursalReportsService],
})
export class DisbursalReportsModule {}
