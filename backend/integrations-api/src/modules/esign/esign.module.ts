import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { EsignController } from './esign.controller';
import { EsignService } from './esign.service';
import { EsignCallbackController } from './esign-callback.controller';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [EsignController, EsignCallbackController],
  providers: [EsignService],
})
export class EsignModule {}
