import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { VideoKycController } from './video-kyc.controller';
import { VideoKycService } from './video-kyc.service';
import { VideoKycCallbackController } from './video-kyc-callback.controller';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [VideoKycController, VideoKycCallbackController],
  providers: [VideoKycService],
})
export class VideoKycModule {}
