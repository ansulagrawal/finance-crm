import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AllocateFieldVerificationDto } from './dto/allocate-field-verification.dto';
import { InitiateFieldVerificationDto } from './dto/initiate-field-verification.dto';
import { ListFieldVerificationQueueQueryDto } from './dto/list-field-verification-queue-query.dto';
import { SubmitFieldVerificationReportDto } from './dto/submit-field-verification-report.dto';
import { FieldVerificationService } from './field-verification.service';

@ApiTags('Field Verification')
@ApiCookieAuth()
@Roles('CO1', 'CO2', 'CO3', 'CFE1')
@Controller('field-verification')
export class FieldVerificationController {
  constructor(
    private readonly fieldVerificationService: FieldVerificationService,
  ) {}

  @Get('leads/:leadId')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Get the residence/office field verification record for a lead (one row per lead)',
  })
  get(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.fieldVerificationService.getForLead(leadId);
  }

  @Post('leads/:leadId')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Initiate a residence or office field verification track for a lead',
  })
  initiate(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: InitiateFieldVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fieldVerificationService.initiate(leadId, dto, user.sub);
  }

  @Get('queue')
  @ApiOperation({
    summary:
      'List the field verification queue for the current user, filtered per role/scope',
  })
  queue(
    @Query() query: ListFieldVerificationQueueQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fieldVerificationService.listQueue(query, user.sub, user.roles);
  }

  @Roles('CO2', 'CO3')
  @Patch('leads/:leadId/allocate')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      "Allocate a lead's residence or office field verification track to a field executive",
  })
  allocate(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: AllocateFieldVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fieldVerificationService.allocate(leadId, dto, user.sub);
  }

  @Patch('leads/:leadId/report')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Submit a field verification report for one track of a lead',
  })
  submitReport(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SubmitFieldVerificationReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fieldVerificationService.submitReport(leadId, dto, user.sub);
  }
}
