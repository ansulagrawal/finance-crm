import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RunoModule } from '../runo/runo.module';
import { CallManagementController } from './call-management.controller';
import { CallManagementService } from './call-management.service';

@Module({
  imports: [CommonModule, RunoModule],
  controllers: [CallManagementController],
  providers: [CallManagementService],
})
export class CallManagementModule {}
