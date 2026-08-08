import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import {
  ExportCatalogsController,
  MisReportCatalogsController,
} from './report-catalogs.controller';
import { ReportCatalogsService } from './report-catalogs.service';

@Module({
  imports: [CommonModule],
  controllers: [ExportCatalogsController, MisReportCatalogsController],
  providers: [ReportCatalogsService],
})
export class ReportCatalogsModule {}
