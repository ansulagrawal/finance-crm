import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.util';
import { RequireExportPermission } from '../../common/decorators/require-export-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { LeadExportsService } from './lead-exports.service';

@ApiTags('Lead Exports')
@ApiCookieAuth()
@Controller('lead-exports')
export class LeadExportsController {
  constructor(private readonly leadExportsService: LeadExportsService) {}

  @Get('lead-duplicate')
  @ApiOperation({ summary: 'Export duplicate lead records as CSV' })
  @RequireExportPermission(1)
  async leadDuplicate(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.leadExportsService.leadDuplicate(query);
    sendCsv(res, 'lead-duplicate.csv', rows);
  }

  @Get('lead-total')
  @ApiOperation({
    summary:
      'Export total lead counts as CSV, optionally filtered by UTM source',
  })
  @RequireExportPermission(3)
  async leadTotal(
    @Query() query: DateRangeQueryDto & { utmSource?: string },
    @Res() res: Response,
  ) {
    const rows = await this.leadExportsService.leadTotal(query);
    sendCsv(res, 'lead-total.csv', rows);
  }

  @Get('lead-rejected')
  @ApiOperation({ summary: 'Export rejected leads as CSV' })
  @RequireExportPermission(4)
  async leadRejected(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.leadExportsService.leadRejected(query);
    sendCsv(res, 'lead-rejected.csv', rows);
  }

  @Get('partial-lead-data')
  @ApiOperation({
    summary: 'Export incomplete/partial lead submissions as CSV',
  })
  @RequireExportPermission(43)
  async partialLeadData(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.leadExportsService.partialLeadData(query);
    sendCsv(res, 'partial-lead-data.csv', rows);
  }

  @Get('lead-interaction-summary')
  @ApiOperation({ summary: 'Export lead interaction/follow-up summary as CSV' })
  @RequireExportPermission(52)
  async leadInteractionSummary(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.leadExportsService.leadInteractionSummary(query);
    sendCsv(res, 'lead-interaction-summary.csv', rows);
  }
}
