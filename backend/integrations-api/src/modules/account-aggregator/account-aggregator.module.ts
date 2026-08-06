import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { AccountAggregatorCallbackController } from './account-aggregator-callback.controller';
import { AccountAggregatorController } from './account-aggregator.controller';
import { AccountAggregatorService } from './account-aggregator.service';

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [
    AccountAggregatorController,
    AccountAggregatorCallbackController,
  ],
  providers: [AccountAggregatorService],
})
export class AccountAggregatorModule {}
