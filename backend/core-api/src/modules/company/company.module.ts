import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CompanyHolidaysController } from './company-holidays.controller';
import { CompanyHolidaysService } from './company-holidays.service';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [CommonModule],
  providers: [CompanyService, CompanyHolidaysService],
  controllers: [CompanyController, CompanyHolidaysController],
  exports: [CompanyHolidaysService],
})
export class CompanyModule {}
