import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireMisPermission } from '../../common/decorators/require-mis-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { LeadReportsService } from './lead-reports.service';

@ApiTags('Lead Reports')
@ApiCookieAuth()
@Controller('lead-reports')
export class LeadReportsController {
  constructor(private readonly leadReportsService: LeadReportsService) {}

  @Get('lead-source')
  @ApiOperation({ summary: 'Lead counts broken down by lead source' })
  @RequireMisPermission(1)
  leadSource(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadSource(query);
  }

  @Get('lead-source-status')
  @ApiOperation({ summary: 'Lead status breakdown by lead source' })
  @RequireMisPermission(8)
  leadSourceStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadSourceStatus(query);
  }

  @Get('sanction-productivity-fresh')
  @ApiOperation({
    summary:
      'Sanction productivity metrics for new (fresh) leads up to a given date',
  })
  @RequireMisPermission(18)
  sanctionProductivityFresh(@Query('toDate') toDate: string) {
    if (!toDate) {
      throw new BadRequestException('toDate is required');
    }
    return this.leadReportsService.sanctionProductivity('NEW', toDate);
  }

  @Get('sanction-productivity-repeat')
  @ApiOperation({
    summary:
      'Sanction productivity metrics for repeat leads up to a given date',
  })
  @RequireMisPermission(19)
  sanctionProductivityRepeat(@Query('toDate') toDate: string) {
    if (!toDate) {
      throw new BadRequestException('toDate is required');
    }
    return this.leadReportsService.sanctionProductivity('REPEAT', toDate);
  }

  @Get('hourly-status-wise')
  @ApiOperation({ summary: 'Lead status breakdown by hour of day' })
  @RequireMisPermission(27)
  hourlyStatusWise(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.hourlyStatusWise(query);
  }

  @Get('lead-utm-source-status')
  @ApiOperation({ summary: 'Lead status breakdown by UTM source' })
  @RequireMisPermission(28)
  leadUtmSourceStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadUtmSourceStatus(query);
  }

  @Get('lead-sourcing-city-wise-status')
  @ApiOperation({ summary: 'Lead status breakdown by sourcing city' })
  @RequireMisPermission(31)
  leadSourcingCityWiseStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadSourcingCityWiseStatus(query);
  }

  @Get('lead-city-wise-status')
  @ApiOperation({ summary: 'Lead status breakdown by applicant city' })
  @RequireMisPermission(32)
  leadCityWiseStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadCityWiseStatus(query);
  }

  @Get('rejection-analysis')
  @ApiOperation({ summary: 'Lead rejection reason analysis over a date range' })
  @RequireMisPermission(49)
  rejectionAnalysis(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.rejectionAnalysis(query);
  }

  @Get('lead-utm-campaign-status')
  @ApiOperation({ summary: 'Lead status breakdown by UTM campaign' })
  @RequireMisPermission(50)
  leadUtmCampaignStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadUtmCampaignStatus(query);
  }

  @Get('lead-assignment-summary')
  @ApiOperation({ summary: 'Summary of lead assignments to executives' })
  @RequireMisPermission(51)
  leadAssignmentSummary() {
    return this.leadReportsService.leadAssignmentSummary();
  }

  /** Also serves legacy report_id 54 — a legacy dispatcher bug that just
   * re-invokes this same model under a drifted label, not a distinct
   * report (see TODO.md / REPORTING-QUESTIONS-FOR-CLIENT.md). */
  @Get('source-utm-source-status')
  @ApiOperation({ summary: 'Lead status breakdown by source and UTM source' })
  @RequireMisPermission(52)
  sourceUtmSourceStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.sourceUtmSourceStatus(query);
  }

  @Get('lead-rejection-analysis-campaign')
  @ApiOperation({ summary: 'Lead rejection reason analysis by UTM campaign' })
  @RequireMisPermission(53)
  leadRejectionAnalysisCampaign(
    @Query() query: DateRangeQueryDto & { utmCampaign?: string },
  ) {
    return this.leadReportsService.leadRejectionAnalysisCampaign(query);
  }

  @Get('system-rejected-status')
  @ApiOperation({ summary: 'Leads auto-rejected by the system, by status' })
  @RequireMisPermission(74)
  systemRejectedStatus(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.systemRejectedStatus(query);
  }

  @Get('lead-conversion')
  @ApiOperation({
    summary: 'Lead-to-disbursal conversion funnel over a date range',
  })
  @RequireMisPermission(75)
  leadConversion(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadConversion(query);
  }

  @Get('lead-digital-summary')
  @ApiOperation({
    summary: 'Summary of leads originating from digital channels',
  })
  @RequireMisPermission(81)
  leadDigitalSummary(@Query() query: DateRangeQueryDto) {
    return this.leadReportsService.leadDigitalSummary(query);
  }

  /** No `master_mis_report` row exists for this one (code-only route, see
   * TODO.md) — left ungated by `@RequireMisPermission` since there is no
   * legacy report id to gate it against. */
  @Get('process-tat')
  @ApiOperation({
    summary: 'Lead processing turnaround time (TAT) from a given date',
  })
  processTat(@Query('fromDate') fromDate: string) {
    if (!fromDate) {
      throw new BadRequestException('fromDate is required');
    }
    return this.leadReportsService.processTat(fromDate);
  }
}
