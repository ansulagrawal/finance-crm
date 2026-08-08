import { PartialType } from '@nestjs/swagger';
import { CreateReportCatalogDto } from './create-report-catalog.dto';

export class UpdateReportCatalogDto extends PartialType(
  CreateReportCatalogDto,
) {}
