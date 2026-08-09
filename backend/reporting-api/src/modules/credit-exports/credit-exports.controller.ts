import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sendCsv } from '../../common/csv.util';
import { RequireExportPermission } from '../../common/decorators/require-export-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { CreditExportsService } from './credit-exports.service';

@ApiTags('Credit Exports')
@ApiCookieAuth()
@Controller('credit-exports')
export class CreditExportsController {
  constructor(private readonly service: CreditExportsService) {}

  @RequireExportPermission(5)
  @ApiOperation({ summary: 'Export total sanctioned loans as CSV' })
  @Get('total-sanction')
  async totalSanction(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    sendCsv(res, 'total-sanction.csv', await this.service.totalSanction(query));
  }

  @RequireExportPermission(40)
  @ApiOperation({ summary: 'Export total approved sanctions as CSV' })
  @Get('total-approved-sanction')
  async totalApprovedSanction(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    sendCsv(
      res,
      'total-approved-sanction.csv',
      await this.service.totalApprovedSanction(query),
    );
  }

  @RequireExportPermission(41)
  @ApiOperation({
    summary:
      'Export BRE (business rules engine) rule evaluation results as CSV',
  })
  @Get('bre-rules-result')
  async breRulesResult(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    sendCsv(
      res,
      'bre-rules-result.csv',
      await this.service.breRulesResult(query),
    );
  }

  @RequireExportPermission(16)
  @ApiOperation({ summary: 'Export CIBIL (credit bureau) report data as CSV' })
  @Get('cibil-report')
  async cibilReport(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    sendCsv(res, 'cibil-report.csv', await this.service.cibilReport(query));
  }

  @RequireExportPermission(20)
  @ApiOperation({ summary: 'Export blacklisted applicants/customers as CSV' })
  @Get('blacklisted')
  async blacklisted(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    sendCsv(res, 'blacklisted.csv', await this.service.blacklisted(query));
  }

  @RequireExportPermission(27)
  @ApiOperation({ summary: 'Export loans with waived amounts as CSV' })
  @Get('loan-waived')
  async loanWaived(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    sendCsv(res, 'loan-waived.csv', await this.service.loanWaived(query));
  }
}
