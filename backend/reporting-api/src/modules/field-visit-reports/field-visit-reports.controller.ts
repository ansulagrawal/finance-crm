import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireMisPermission } from '../../common/decorators/require-mis-permission.decorator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { FieldVisitReportsService } from './field-visit-reports.service';

@ApiTags('Field Visit Reports')
@ApiCookieAuth()
@Controller('field-visit-reports')
export class FieldVisitReportsController {
  constructor(private readonly service: FieldVisitReportsService) {}

  @Get('branchwise-visit')
  @ApiOperation({ summary: 'Field visit counts broken down by branch' })
  @RequireMisPermission(16)
  branchwiseVisit(@Query() query: DateRangeQueryDto) {
    return this.service.branchwiseVisit(query);
  }

  @Get('rmwise-visit')
  @ApiOperation({
    summary: 'Field visit counts broken down by relationship manager (RM)',
  })
  @RequireMisPermission(17)
  rmwiseVisit(@Query() query: DateRangeQueryDto) {
    return this.service.rmwiseVisit(query);
  }

  @Get('rm-conveyance')
  @ApiOperation({
    summary: 'Relationship manager (RM) conveyance/travel expense report',
  })
  @RequireMisPermission(20)
  rmConveyance(@Query() query: DateRangeQueryDto) {
    return this.service.rmConveyance(query);
  }
}
