import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DisbursalExportsController } from './disbursal-exports.controller';
import { DisbursalExportsService } from './disbursal-exports.service';

@Module({
  imports: [CommonModule],
  controllers: [DisbursalExportsController],
  providers: [DisbursalExportsService],
})
export class DisbursalExportsModule {}
