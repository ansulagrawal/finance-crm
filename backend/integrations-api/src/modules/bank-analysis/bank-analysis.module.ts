import { StorageModule } from '@finance-crm/common';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BankAnalysisCallbackController } from './bank-analysis-callback.controller';
import { BankAnalysisController } from './bank-analysis.controller';
import { BankAnalysisService } from './bank-analysis.service';

@Module({
  imports: [
    CommonModule,
    HttpModule.register({ timeout: 60_000 }),
    StorageModule,
  ],
  controllers: [BankAnalysisController, BankAnalysisCallbackController],
  providers: [BankAnalysisService],
})
export class BankAnalysisModule {}
