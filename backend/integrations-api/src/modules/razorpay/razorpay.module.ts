import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RazorpayController } from './razorpay.controller';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookController } from './razorpay-webhook.controller';

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [RazorpayController, RazorpayWebhookController],
  providers: [RazorpayService],
})
export class RazorpayModule {}
