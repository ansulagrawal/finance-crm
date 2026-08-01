import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LeadAllocationController } from './lead-allocation.controller';
import { LeadAllocationService } from './lead-allocation.service';

@Module({
  imports: [CommonModule],
  providers: [LeadAllocationService],
  controllers: [LeadAllocationController],
})
export class LeadAllocationModule {}
