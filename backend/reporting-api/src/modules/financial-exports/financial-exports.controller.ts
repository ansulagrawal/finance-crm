import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.util';
import { RequireExportPermission } from '../../common/decorators/require-export-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { FinancialExportsService } from './financial-exports.service';

@ApiTags('Financial Exports')
@ApiCookieAuth()
@Controller('financial-exports')
export class FinancialExportsController {
  constructor(
    private readonly financialExportsService: FinancialExportsService,
  ) {}

  @RequireExportPermission(13)
  @ApiOperation({ summary: 'Export accounts (AC) report as CSV' })
  @Get('ac-report')
  async acReport(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.financialExportsService.acReport(query);
    sendCsv(res, 'ac-report.csv', rows);
  }

  @RequireExportPermission(15)
  @ApiOperation({
    summary: 'Export Tally accounting-software import file as CSV',
  })
  @Get('tally')
  async tally(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.financialExportsService.tallyExport(query);
    sendCsv(res, 'tally-export.csv', rows);
  }

  @RequireExportPermission(47)
  @ApiOperation({ summary: 'Export audit turnaround time (TAT) report as CSV' })
  @Get('audit-tat')
  async auditTat(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.financialExportsService.auditTatReport(query);
    sendCsv(res, 'audit-tat-report.csv', rows);
  }

  @RequireExportPermission(49)
  @ApiOperation({
    summary: 'Export reloan turnaround time (TAT) report as CSV',
  })
  @Get('reloan-tat')
  async reloanTat(@Res() res: Response) {
    const rows = await this.financialExportsService.reloanTatReport();
    sendCsv(res, 'reloan-tat-report.csv', rows);
  }

  @RequireExportPermission(50)
  @ApiOperation({
    summary: 'Export low lead-conversion turnaround time (TAT) report as CSV',
  })
  @Get('low-conversion-tat')
  async lowConversionTat(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.financialExportsService.conversionTatReport(query);
    sendCsv(res, 'low-conversion-tat-report.csv', rows);
  }

  @RequireExportPermission(51)
  @ApiOperation({
    summary: 'Export high lead-conversion turnaround time (TAT) report as CSV',
  })
  @Get('high-conversion-tat')
  async highConversionTat(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.financialExportsService.conversionTatReport(query);
    sendCsv(res, 'high-conversion-tat-report.csv', rows);
  }

  @RequireExportPermission(6)
  @ApiOperation({ summary: 'Export dashboard summary data as CSV' })
  @Get('dashboard-data')
  async dashboardData(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.financialExportsService.dashboardData(query);
    sendCsv(res, 'dashboard-data.csv', rows);
  }
}
