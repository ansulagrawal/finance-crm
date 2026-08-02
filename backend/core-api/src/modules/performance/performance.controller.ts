import { Roles } from '@finance-crm/common';
import { UserTargetAllocationType } from '@finance-crm/database';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UpsertUserTargetDto } from './dto/upsert-user-target.dto';
import { PerformanceService } from './performance.service';

@ApiTags('Performance')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Post('targets')
  @ApiOperation({
    summary:
      "Set a user's sanction or collection target (rolling, no month window)",
  })
  upsertTarget(@Body() dto: UpsertUserTargetDto) {
    return this.performanceService.upsertTarget(dto);
  }

  @Get(':userId')
  @Roles()
  @ApiOperation({
    summary: "Get a user's target vs. achieved figures for a target type",
  })
  @ApiQuery({ name: 'type', enum: UserTargetAllocationType })
  getPerformance(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('type') type: UserTargetAllocationType,
  ) {
    return this.performanceService.getPerformance(userId, type);
  }
}
