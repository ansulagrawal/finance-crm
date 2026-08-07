import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { UanVerificationController } from './uan-verification.controller';
import { UanVerificationService } from './uan-verification.service';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [UanVerificationController],
  providers: [UanVerificationService],
})
export class UanVerificationModule {}
