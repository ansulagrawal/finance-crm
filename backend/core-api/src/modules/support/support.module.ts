import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CamModule } from '../cam/cam.module';
import { LeadsModule } from '../leads/leads.module';
import { VerificationModule } from '../verification/verification.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [CommonModule, LeadsModule, CamModule, VerificationModule],
  providers: [SupportService],
  controllers: [SupportController],
})
export class SupportModule {}
