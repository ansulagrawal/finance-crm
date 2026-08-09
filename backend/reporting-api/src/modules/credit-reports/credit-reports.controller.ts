import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { RequireMisPermission } from '../../common/decorators/require-mis-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { CreditReportsService } from './credit-reports.service';
import { MonthQueryDto } from './dto/month-query.dto';

class ProcessTatQueryDto {
  @IsDateString()
  fromDate: string;
}

@ApiTags('Credit Reports')
@ApiCookieAuth()
@Controller('credit-reports')
export class CreditReportsController {
  constructor(private readonly service: CreditReportsService) {}

  @RequireMisPermission(2)
  @ApiOperation({ summary: 'Turnaround time (TAT) for sanction processing' })
  @Get('sanction-tat')
  sanctionTat(@Query() query: DateRangeQueryDto) {
    return this.service.sanctionTat(query);
  }

  @RequireMisPermission(3)
  @ApiOperation({
    summary: 'Total sanctioned loan counts and amounts over a date range',
  })
  @Get('total-sanction')
  totalSanction(@Query() query: DateRangeQueryDto) {
    return this.service.totalSanction(query);
  }

  @RequireMisPermission(4)
  @ApiOperation({ summary: 'Sanction KPI metrics for a given month' })
  @Get('sanction-kpi')
  sanctionKpi(@Query() query: MonthQueryDto) {
    return this.service.sanctionKpi(query);
  }

  @RequireMisPermission(9)
  @ApiOperation({
    summary: 'Outstanding sanction case counts for a given month',
  })
  @Get('outstanding-sanction-cases')
  outstandingSanctionCases(@Query() query: MonthQueryDto) {
    return this.service.outstandingSanctionCases(query);
  }

  @RequireMisPermission(11)
  @ApiOperation({
    summary: 'Outstanding sanction amounts broken down by user type',
  })
  @Get('user-type-outstanding')
  userTypeOutstanding() {
    return this.service.userTypeOutstanding();
  }

  @RequireMisPermission(25)
  @ApiOperation({
    summary: 'Lead status breakdown for new (first-time) sanctions',
  })
  @Get('lead-status-sanction-wise-new')
  leadStatusSanctionWiseNew(@Query() query: DateRangeQueryDto) {
    return this.service.leadStatusSanctionWiseNew(query);
  }

  @RequireMisPermission(26)
  @ApiOperation({ summary: 'Lead status breakdown for repeat sanctions' })
  @Get('lead-status-sanction-wise-repeat')
  leadStatusSanctionWiseRepeat(@Query() query: DateRangeQueryDto) {
    return this.service.leadStatusSanctionWiseRepeat(query);
  }

  @RequireMisPermission(29)
  @ApiOperation({ summary: 'Outstanding sanction amount for a given month' })
  @Get('outstanding-sanction-amount')
  outstandingSanctionAmount(@Query() query: MonthQueryDto) {
    return this.service.outstandingSanctionAmount(query);
  }

  @RequireMisPermission(36)
  @ApiOperation({
    summary: 'Outstanding sanction cases over a custom date range',
  })
  @Get('outstanding-cases-date-range')
  outstandingCasesDateRange(@Query() query: DateRangeQueryDto) {
    return this.service.outstandingCasesDateRange(query);
  }

  @RequireMisPermission(38)
  @ApiOperation({
    summary: 'Sanction executive turnaround (TA) performance for a given month',
  })
  @Get('sanction-executive-ta')
  sanctionExecutiveTa(@Query() query: MonthQueryDto) {
    return this.service.sanctionExecutiveTa(query);
  }

  @RequireMisPermission(45)
  @ApiOperation({
    summary: 'Sanction executive target achievement for a given month',
  })
  @Get('sanction-executive-achievement')
  sanctionExecutiveAchievement(@Query() query: MonthQueryDto) {
    return this.service.sanctionExecutiveAchievement(query);
  }

  @RequireMisPermission(71)
  @ApiOperation({
    summary: 'Lead status breakdown for repeat sanctions (revised variant)',
  })
  @Get('lead-status-sanction-wise-repeat-new')
  leadStatusSanctionWiseRepeatNew(@Query() query: DateRangeQueryDto) {
    return this.service.leadStatusSanctionWiseRepeatNew(query);
  }

  @RequireMisPermission(76)
  @ApiOperation({
    summary: 'Detailed sanction case breakdown by sanction status',
  })
  @Get('sanction-status-wise-detailed')
  sanctionStatusWiseDetailed(@Query() query: DateRangeQueryDto) {
    return this.service.sanctionStatusWiseDetailed(query);
  }

  @RequireMisPermission(83)
  @ApiOperation({
    summary: 'Sanction executive performance broken down by collection bucket',
  })
  @Get('bucket-wise-sanction-executive')
  bucketWiseSanctionExecutive(@Query() query: DateRangeQueryDto) {
    return this.service.bucketWiseSanctionExecutive(query);
  }

  /** No `master_mis_report` DB row exists for this one — code-only in
   * legacy (`exportProcessTATModel`). Gated with id 80, the next
   * free-looking id in this range; see TODO.md. */
  @RequireMisPermission(80)
  @ApiOperation({
    summary:
      'Process turnaround time (TAT) for credit processing from a given date',
  })
  @Get('process-tat')
  processTat(@Query() query: ProcessTatQueryDto) {
    return this.service.processTat(query.fromDate);
  }
}
