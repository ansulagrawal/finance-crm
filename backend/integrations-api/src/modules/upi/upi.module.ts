import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UpiController } from './upi.controller';
import { UpiService } from './upi.service';
import { UpiCallbackController } from './upi-callback.controller';

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [UpiController, UpiCallbackController],
  providers: [UpiService],
})
export class UpiModule {}
