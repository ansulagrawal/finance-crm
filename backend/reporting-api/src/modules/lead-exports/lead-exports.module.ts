import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LeadExportsController } from './lead-exports.controller';
import { LeadExportsService } from './lead-exports.service';

@Module({
  imports: [CommonModule],
  controllers: [LeadExportsController],
  providers: [LeadExportsService],
})
export class LeadExportsModule {}
