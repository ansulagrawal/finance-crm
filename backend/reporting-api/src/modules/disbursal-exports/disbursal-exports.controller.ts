import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.util';
import { RequireExportPermission } from '../../common/decorators/require-export-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { DisbursalExportsService } from './disbursal-exports.service';

@ApiTags('Disbursal Exports')
@ApiCookieAuth()
@Controller('disbursal-exports')
export class DisbursalExportsController {
  constructor(
    private readonly disbursalExportsService: DisbursalExportsService,
  ) {}

  @Get('loan-disbursed')
  @ApiOperation({ summary: 'Export disbursed loans as CSV' })
  @RequireExportPermission(7)
  async loanDisbursed(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.disbursalExportsService.loanDisbursed(query);
    sendCsv(res, 'loan-disbursed.csv', rows);
  }

  @Get('loan-pending')
  @ApiOperation({ summary: 'Export loans pending NEFT disbursal as CSV' })
  @RequireExportPermission(8)
  async loanPending(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.disbursalExportsService.loanPendingNeftFile(query);
    sendCsv(res, 'loan-pending-neft.csv', rows);
  }

  @Get('loan-disbursed-sendback')
  @ApiOperation({
    summary: 'Export disbursed loans sent back for correction as CSV',
  })
  @RequireExportPermission(18)
  async loanDisbursedSendback(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows =
      await this.disbursalExportsService.loanDisbursedSendback(query);
    sendCsv(res, 'loan-disbursed-sendback.csv', rows);
  }

  @Get('loan-disbursed-hold')
  @ApiOperation({ summary: 'Export disbursed loans currently on hold as CSV' })
  @RequireExportPermission(19)
  async loanDisbursedHold(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.disbursalExportsService.loanDisbursedHold(query);
    sendCsv(res, 'loan-disbursed-hold.csv', rows);
  }

  @Get('new-loan-disbursed')
  @ApiOperation({ summary: 'Export newly disbursed loans as CSV' })
  @RequireExportPermission(37)
  async newLoanDisbursed(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows = await this.disbursalExportsService.newLoanDisbursed(query);
    sendCsv(res, 'new-loan-disbursed.csv', rows);
  }

  @Get('loan-dump')
  @ApiOperation({ summary: 'Export full loan dump report as CSV' })
  @RequireExportPermission(39)
  async loanDump(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.disbursalExportsService.loanDumpReport(query);
    sendCsv(res, 'loan-dump.csv', rows);
  }

  @Get('master-disbursal-report')
  @ApiOperation({ summary: 'Export master disbursal report as CSV' })
  @RequireExportPermission(45)
  async masterDisbursalReport(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows =
      await this.disbursalExportsService.masterDisbursalReport(query);
    sendCsv(res, 'master-disbursal-report.csv', rows);
  }

  @Get('disbursal-account-report')
  @ApiOperation({ summary: 'Export disbursal bank account report as CSV' })
  @RequireExportPermission(46)
  async disbursalAccountReport(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const rows =
      await this.disbursalExportsService.disbursalAccountReport(query);
    sendCsv(res, 'disbursal-account-report.csv', rows);
  }

  @Get('closed-loan')
  @ApiOperation({ summary: 'Export closed loans as CSV' })
  @RequireExportPermission(48)
  async closedLoan(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const rows = await this.disbursalExportsService.closedLoan(query);
    sendCsv(res, 'closed-loan.csv', rows);
  }
}
