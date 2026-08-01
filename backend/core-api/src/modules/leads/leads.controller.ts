import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ChangeLeadStatusDto } from './dto/change-lead-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateLeadCustomerReferenceDto } from './dto/create-lead-customer-reference.dto';
import { CreateLeadFollowupDto } from './dto/create-lead-followup.dto';
import { ListLeadFollowupsQueryDto } from './dto/list-lead-followups-query.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { RejectLeadDto } from './dto/reject-lead.dto';
import { SelfAllocateLeadsDto } from './dto/self-allocate-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpsertLeadCustomerDto } from './dto/upsert-lead-customer.dto';
import { UpsertLeadEmploymentDto } from './dto/upsert-lead-employment.dto';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@ApiCookieAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads with pagination and filters' })
  list(@Query() query: ListLeadsQueryDto) {
    return this.leadsService.list(query);
  }

  @Get('queue')
  @ApiOperation({
    summary:
      "List the current user's lead queue, filtered per role/scope (falls back to the unrestricted list for roles with no defined queue)",
  })
  listQueue(
    @Query() query: ListLeadsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.listQueue(query, user.sub, user.roles);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Get a lead by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Update lead fields' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Change the workflow status of a lead' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.changeStatus(id, dto, user.sub);
  }

  @Patch(':id/assign')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Assign a lead to a user' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.assign(id, dto, user.sub);
  }

  @Post('self-allocate')
  @ApiOperation({
    summary:
      'Self-service bulk claim: assign a batch of leads to the acting user, transitioning each to the target queue\'s "in process" status',
  })
  selfAllocate(
    @Body() dto: SelfAllocateLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.selfAllocate(dto, user.sub, user.roles);
  }

  @Post(':id/reject')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Reject a lead with a reason' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.reject(id, dto, user.sub);
  }

  @Get(':id/customer')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Get the customer record attached to a lead (404 if none yet)',
  })
  findCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.findCustomer(id);
  }

  @Put(':id/customer')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Create or update the customer record attached to a lead',
  })
  upsertCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertLeadCustomerDto,
  ) {
    return this.leadsService.upsertCustomer(id, dto);
  }

  @Get(':id/employment')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Get the employment record attached to a lead (404 if none yet)',
  })
  findEmployment(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.findEmployment(id);
  }

  @Put(':id/employment')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Create or update the employment details attached to a lead',
  })
  upsertEmployment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertLeadEmploymentDto,
  ) {
    return this.leadsService.upsertEmployment(id, dto);
  }

  @Get(':id/references')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List customer references for a lead' })
  listReferences(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.listReferences(id);
  }

  @Post(':id/references')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Add a customer reference to a lead' })
  addReference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLeadCustomerReferenceDto,
  ) {
    return this.leadsService.addReference(id, dto);
  }

  @Delete(':id/references/:referenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'referenceId',
    description: 'Customer reference ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Remove a customer reference from a lead' })
  removeReference(
    @Param('id', ParseIntPipe) id: number,
    @Param('referenceId', ParseIntPipe) referenceId: number,
  ) {
    return this.leadsService.removeReference(id, referenceId);
  }

  @Get(':id/followups')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List followup/audit-trail entries for a lead' })
  listFollowups(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListLeadFollowupsQueryDto,
  ) {
    return this.leadsService.listFollowups(id, query);
  }

  @Post(':id/followups')
  @ApiParam({ name: 'id', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Add a followup/remark entry to a lead' })
  addFollowup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLeadFollowupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.addFollowup(id, dto, user.sub);
  }
}
