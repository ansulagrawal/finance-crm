import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DigitapModule } from '../digitap/digitap.module';
import { SignzyModule } from '../signzy/signzy.module';
import { PoiVerificationController } from './poi-verification.controller';
import { PoiVerificationService } from './poi-verification.service';

@Module({
  imports: [CommonModule, SignzyModule, DigitapModule],
  controllers: [PoiVerificationController],
  providers: [PoiVerificationService],
})
export class PoiVerificationModule {}
