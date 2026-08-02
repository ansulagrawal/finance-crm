import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { FieldVerificationController } from './field-verification.controller';
import { FieldVerificationService } from './field-verification.service';

@Module({
  imports: [CommonModule],
  controllers: [FieldVerificationController],
  providers: [FieldVerificationService],
})
export class FieldVerificationModule {}
