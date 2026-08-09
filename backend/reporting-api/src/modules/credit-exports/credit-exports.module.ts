import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CreditExportsController } from './credit-exports.controller';
import { CreditExportsService } from './credit-exports.service';

@Module({
  imports: [CommonModule],
  controllers: [CreditExportsController],
  providers: [CreditExportsService],
})
export class CreditExportsModule {}
