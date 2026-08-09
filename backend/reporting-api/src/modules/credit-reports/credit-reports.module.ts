import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CreditReportsController } from './credit-reports.controller';
import { CreditReportsService } from './credit-reports.service';

@Module({
  imports: [CommonModule],
  controllers: [CreditReportsController],
  providers: [CreditReportsService],
})
export class CreditReportsModule {}
