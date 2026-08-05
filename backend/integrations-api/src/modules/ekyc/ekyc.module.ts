import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DigitapModule } from '../digitap/digitap.module';
import { SignzyModule } from '../signzy/signzy.module';
import { EkycController } from './ekyc.controller';
import { EkycService } from './ekyc.service';

@Module({
  imports: [CommonModule, SignzyModule, DigitapModule],
  controllers: [EkycController],
  providers: [EkycService],
})
export class EkycModule {}
