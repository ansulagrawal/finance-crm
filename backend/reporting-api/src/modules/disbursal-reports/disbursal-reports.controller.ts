import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireMisPermission } from '../../common/decorators/require-mis-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { DisbursalReportsService } from './disbursal-reports.service';
import { MonthQueryDto } from './dto/month-query.dto';

@ApiTags('Disbursal Reports')
@ApiCookieAuth()
@Controller('disbursal-reports')
export class DisbursalReportsController {
  constructor(
    private readonly disbursalReportsService: DisbursalReportsService,
  ) {}

  @Get('disbursal-summary')
  @ApiOperation({ summary: 'Disbursal summary for a given month' })
  @RequireMisPermission(6)
  disbursalSummary(@Query() query: MonthQueryDto) {
    return this.disbursalReportsService.disbursalSummary(query);
  }

  @Get('monthly-disbursal')
  @ApiOperation({ summary: 'Disbursal totals broken down by month' })
  @RequireMisPermission(14)
  monthlyDisbursal(@Query() query: MonthQueryDto) {
    return this.disbursalReportsService.monthlyDisbursal(query);
  }

  @Get('hourly-disbursal')
  @ApiOperation({ summary: 'Disbursal amounts broken down by hour of day' })
  @RequireMisPermission(15)
  hourlyDisbursal(@Query() query: DateRangeQueryDto) {
    return this.disbursalReportsService.hourlyDisbursal(query);
  }

  @Get('fy-disbursement-collection')
  @ApiOperation({
    summary: 'Disbursement vs collection totals for a financial year',
  })
  @RequireMisPermission(34)
  fyDisbursementCollection(@Query() query: MonthQueryDto) {
    return this.disbursalReportsService.fyDisbursementCollection(query);
  }

  /** report_id 57 — see service method doc: legacy has no real logic to
   * port here, this is a rebuild of what the report is meant to show. */
  @Get('hourly-loan-disbursal-by-executive')
  @ApiOperation({
    summary: 'Hourly loan disbursal counts broken down by executive',
  })
  @RequireMisPermission(57)
  hourlyLoanDisbursalByExecutive(@Query() query: DateRangeQueryDto) {
    return this.disbursalReportsService.hourlyLoanDisbursalByExecutive(query);
  }

  @Get('disbursal-date-wise')
  @ApiOperation({ summary: 'Disbursal counts and amounts broken down by date' })
  @RequireMisPermission(70)
  disbursalDateWise(@Query() query: DateRangeQueryDto) {
    return this.disbursalReportsService.disbursalDateWise(query);
  }

  @Get('disbursal-executive-wise')
  @ApiOperation({
    summary: 'Disbursal counts and amounts broken down by executive',
  })
  @RequireMisPermission(72)
  disbursalExecutiveWise(@Query() query: DateRangeQueryDto) {
    return this.disbursalReportsService.disbursalExecutiveWise(query);
  }

  /** No `master_mis_report` DB row exists for this one — code-only in
   * legacy (`CronReportController::disbursal_head_approval_hour_report`). */
  @Get('disbursal-executive-ta')
  @ApiOperation({
    summary:
      'Average turnaround time (hours) between disbursal assignment and approval, by executive',
  })
  @RequireMisPermission(84)
  disbursalExecutiveTa(@Query() query: DateRangeQueryDto) {
    return this.disbursalReportsService.disbursalExecutiveTa(query);
  }
}
