import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AllocateAuditDto } from './dto/allocate-audit.dto';
import { ApprovalReasonAuditDto } from './dto/approval-reason-audit.dto';
import { HoldAuditDto } from './dto/hold-audit.dto';
import { ListAuditQueueQueryDto } from './dto/list-audit-queue-query.dto';
import { RecommendAuditDto } from './dto/recommend-audit.dto';
import { SendBackAuditDto } from './dto/send-back-audit.dto';
import { SendToPostAuditDto } from './dto/send-to-post-audit.dto';
import { SendToPreAuditDto } from './dto/send-to-pre-audit.dto';

@ApiTags('Audit')
@ApiCookieAuth()
@Roles('AU', 'AM', 'AH')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('queue')
  @ApiOperation({
    summary:
      'List the audit queue for the current user, filtered per role/scope',
  })
  list(
    @Query() query: ListAuditQueueQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.list(query, user.sub, user.roles);
  }

  @Get('leads/:leadId/history')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Get the audit workflow history for a lead' })
  history(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.auditService.history(leadId);
  }

  @Post('leads/:leadId/send-to-pre-audit')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Send a lead into the pre-audit stage' })
  sendToPreAudit(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SendToPreAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.sendToPreAudit(leadId, dto, user.sub);
  }

  @Post('leads/:leadId/send-to-post-audit')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Send a lead into the post-audit stage' })
  sendToPostAudit(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SendToPostAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.sendToPostAudit(leadId, dto, user.sub);
  }

  @Roles('AM', 'AH')
  @Post('allocate')
  @ApiOperation({ summary: 'Allocate audit queue leads to an auditor' })
  allocate(
    @Body() dto: AllocateAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.allocate(dto, user.sub);
  }

  @Post('leads/:leadId/hold')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Put a lead on hold during audit with a reason' })
  hold(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: HoldAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.hold(leadId, dto, user.sub);
  }

  @Roles('AM', 'AH')
  @Post('leads/:leadId/recommend')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Record an audit recommendation for a lead' })
  recommend(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: RecommendAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.recommend(leadId, dto, user.sub);
  }

  @Roles('AM', 'AH')
  @Post('leads/:leadId/send-back')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Send an audited lead back for revision' })
  sendBack(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SendBackAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.sendBack(leadId, dto, user.sub);
  }

  @Post('leads/:leadId/approval-reason')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Record the approval reason for a lead during audit',
  })
  approvalReason(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: ApprovalReasonAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.recordApprovalReason(leadId, dto, user.sub);
  }
}
