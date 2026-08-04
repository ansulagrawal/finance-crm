import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SignzyModule } from '../signzy/signzy.module';
import { DomainEmailVerificationController } from './domain-email-verification.controller';
import { DomainEmailVerificationService } from './domain-email-verification.service';

@Module({
  imports: [CommonModule, SignzyModule],
  controllers: [DomainEmailVerificationController],
  providers: [DomainEmailVerificationService],
})
export class DomainEmailVerificationModule {}
