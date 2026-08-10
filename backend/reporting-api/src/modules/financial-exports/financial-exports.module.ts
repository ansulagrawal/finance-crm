import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { FinancialExportsController } from './financial-exports.controller';
import { FinancialExportsService } from './financial-exports.service';

@Module({
  imports: [CommonModule],
  controllers: [FinancialExportsController],
  providers: [FinancialExportsService],
})
export class FinancialExportsModule {}
