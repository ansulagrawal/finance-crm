import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { FieldVisitReportsController } from './field-visit-reports.controller';
import { FieldVisitReportsService } from './field-visit-reports.service';

@Module({
  imports: [CommonModule],
  controllers: [FieldVisitReportsController],
  providers: [FieldVisitReportsService],
})
export class FieldVisitReportsModule {}
