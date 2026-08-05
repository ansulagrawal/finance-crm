import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { IciciDisbursementController } from './icici-disbursement.controller';
import { IciciDisbursementService } from './icici-disbursement.service';

@Module({
  imports: [HttpModule, ConfigModule, CommonModule],
  controllers: [IciciDisbursementController],
  providers: [IciciDisbursementService],
  exports: [IciciDisbursementService],
})
export class IciciDisbursementModule {}
