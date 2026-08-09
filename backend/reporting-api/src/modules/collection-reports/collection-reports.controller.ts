import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireMisPermission } from '../../common/decorators/require-mis-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { CollectionReportsService } from './collection-reports.service';
import { ExecutiveCollectionQueryDto } from './dto/executive-collection-query.dto';
import { FinancialYearQueryDto } from './dto/financial-year-query.dto';
import { MonthQueryDto } from './dto/month-query.dto';

@ApiTags('Collection Reports')
@ApiCookieAuth()
@Controller('collection-reports')
export class CollectionReportsController {
  constructor(private readonly service: CollectionReportsService) {}

  @Get('collection-percentage-by-executive')
  @ApiOperation({
    summary:
      'Collection percentage achieved by each collection executive over a date range',
  })
  @RequireMisPermission(5)
  collectionPercentageByExecutive(@Query() query: DateRangeQueryDto) {
    return this.service.collectionPercentageByExecutive(query);
  }

  @Get('monthwise-pending-collection')
  @ApiOperation({ summary: 'Pending collection amounts broken down by month' })
  @RequireMisPermission(7)
  monthwisePendingCollection() {
    return this.service.monthwisePendingCollection();
  }

  @Get('collection-calls-by-time')
  @ApiOperation({
    summary: 'Collection call volume broken down by time of day',
  })
  @RequireMisPermission(10)
  collectionCallsByTime(@Query() query: DateRangeQueryDto) {
    return this.service.collectionCallsByTime(query);
  }

  @Get('collection-calls-by-status')
  @ApiOperation({
    summary: 'Collection call outcomes broken down by call status',
  })
  @RequireMisPermission(12)
  collectionCallsByStatus(@Query() query: DateRangeQueryDto) {
    return this.service.collectionCallsByStatus(query);
  }

  @Get('monthly-collection-detail')
  @ApiOperation({ summary: 'Detailed collection breakdown for a given month' })
  @RequireMisPermission(13)
  monthlyCollectionDetail(@Query() query: MonthQueryDto) {
    return this.service.monthlyCollectionDetail(query);
  }

  @Get('payment-analysis-by-disbursal-month')
  @ApiOperation({
    summary:
      'Repayment performance analyzed by original loan disbursal month, for a financial year',
  })
  @RequireMisPermission(21)
  paymentAnalysisByDisbursalMonth(@Query() query: FinancialYearQueryDto) {
    return this.service.paymentAnalysisByDisbursalMonth(query);
  }

  @Get('pre-collection-by-month')
  @ApiOperation({
    summary: 'Pre-collection (pre-due) case counts and amounts by month',
  })
  @RequireMisPermission(22)
  preCollectionByMonth(@Query() query: MonthQueryDto) {
    return this.service.preCollectionByMonth(query);
  }

  @Get('collection-by-month')
  @ApiOperation({ summary: 'Collection totals broken down by month' })
  @RequireMisPermission(23)
  collectionByMonth(@Query() query: MonthQueryDto) {
    return this.service.collectionByMonth(query);
  }

  @Get('recovery-by-month')
  @ApiOperation({ summary: 'Recovery totals broken down by month' })
  @RequireMisPermission(24)
  recoveryByMonth(@Query() query: MonthQueryDto) {
    return this.service.recoveryByMonth(query);
  }

  @Get('collection-bucket-case-wise')
  @ApiOperation({ summary: 'Case count by collection bucket (DPD range)' })
  @RequireMisPermission(30)
  collectionBucketCaseWise(@Query() query: DateRangeQueryDto) {
    return this.service.collectionBucketCaseWise(query, false);
  }

  @Get('fy-repayment-collection')
  @ApiOperation({ summary: 'Repayment collection totals for a financial year' })
  @RequireMisPermission(35)
  fyRepaymentCollection(@Query() query: FinancialYearQueryDto) {
    return this.service.fyRepaymentCollection(query);
  }

  @Get('collection-by-collection-executive')
  @ApiOperation({
    summary: 'Collection totals grouped by collection executive',
  })
  @RequireMisPermission(39)
  collectionByCollectionExecutive(@Query() query: ExecutiveCollectionQueryDto) {
    return this.service.collectionByCollectionExecutive(query);
  }

  @Get('collection-by-sanction-executive')
  @ApiOperation({ summary: 'Collection totals grouped by sanction executive' })
  @RequireMisPermission(41)
  collectionBySanctionExecutive(@Query() query: ExecutiveCollectionQueryDto) {
    return this.service.collectionBySanctionExecutive(query);
  }

  @Get('collection-by-branch')
  @ApiOperation({ summary: 'Collection totals grouped by branch' })
  @RequireMisPermission(43)
  collectionByBranch(@Query() query: ExecutiveCollectionQueryDto) {
    return this.service.collectionByBranch(query);
  }

  @Get('collection-bucket-case-wise-amount')
  @ApiOperation({
    summary: 'Outstanding amount by collection bucket (DPD range)',
  })
  @RequireMisPermission(47)
  collectionBucketCaseWiseAmount(@Query() query: DateRangeQueryDto) {
    return this.service.collectionBucketCaseWise(query, true);
  }

  @Get('hourly-collection')
  @ApiOperation({ summary: 'Collection amounts broken down by hour of day' })
  @RequireMisPermission(48)
  hourlyCollection(@Query() query: DateRangeQueryDto) {
    return this.service.hourlyCollection(query);
  }

  @Get('sanction-wise-lead-conversion')
  @ApiOperation({
    summary: 'Lead-to-sanction conversion counts for a given date',
  })
  @RequireMisPermission(55)
  sanctionWiseLeadConversion(@Query('date') date: string) {
    return this.service.sanctionWiseLeadConversion(date);
  }

  @Get('current-bucket-status')
  @ApiOperation({
    summary: 'Current snapshot of loan cases by collection bucket status',
  })
  @RequireMisPermission(73)
  currentBucketStatus() {
    return this.service.currentBucketStatus();
  }

  /** No `master_mis_report` DB row exists for this one — code-only in
   * legacy (`CronReportController::collection_approval_hour_report`). */
  @Get('collection-approval-hour')
  @ApiOperation({
    summary:
      'Average turnaround time (hours) between collection entry and verification approval, by user',
  })
  @RequireMisPermission(85)
  collectionApprovalHour(@Query() query: DateRangeQueryDto) {
    return this.service.collectionApprovalHour(query);
  }
}
