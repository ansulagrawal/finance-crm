import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { BankVerificationController } from './bank-verification.controller';
import { BankVerificationService } from './bank-verification.service';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [BankVerificationController],
  providers: [BankVerificationService],
})
export class BankVerificationModule {}
