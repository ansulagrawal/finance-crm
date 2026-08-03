import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UpsertCamDto } from '../cam/dto/upsert-cam.dto';
import { UpsertLeadCustomerDto } from '../leads/dto/upsert-lead-customer.dto';
import { UpsertLeadEmploymentDto } from '../leads/dto/upsert-lead-employment.dto';
import { CreateCustomerBankingDto } from '../verification/dto/create-customer-banking.dto';
import { AllocationOverrideDto } from './dto/allocation-override.dto';
import { SupportService } from './support.service';

/**
 * Ops-support toolkit — ports legacy `SupportController.php`. These
 * endpoints let SA/CA-role staff correct or reset a lead's data outside
 * the normal per-stage workflow (e.g. resetting a stuck eKYC link,
 * reassigning ownership after the fact, fixing a bad bank detail before
 * disbursal). Every write is gated so it only applies to a lead that's
 * still active and not yet disbursed, and every write leaves a
 * `LeadFollowup` audit trail.
 */
@ApiTags('Support')
@ApiCookieAuth()
@Roles('SA', 'CA')
@Controller('support/leads/:leadId')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // Legacy (`SupportController.php:40,58`) explicitly grants these two
  // resets to `ST` (Support Tech) alongside `CA` — not the rest of this
  // controller. `@Roles('ST')` overrides the class-level `@Roles('SA','CA')`
  // for just these two handlers; `SA`/`CA` still pass via `RolesGuard`'s own
  // universal admin override, so this only adds `ST`, not removes anyone.
  @Post('ekyc/reset')
  @Roles('ST')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Reset the eKYC link so the customer can restart it',
  })
  resetEkyc(
    @Param('leadId', ParseIntPipe) leadId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.resetEkyc(leadId, user.sub);
  }

  @Post('esign/reset')
  @Roles('ST')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Reset the eSign link so the customer can restart it',
  })
  resetEsign(
    @Param('leadId', ParseIntPipe) leadId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.resetEsign(leadId, user.sub);
  }

  @Post('account-aggregator/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Reset the Account Aggregator consent so the customer can restart it',
  })
  resetAccountAggregator(
    @Param('leadId', ParseIntPipe) leadId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.resetAccountAggregator(leadId, user.sub);
  }

  @Patch('allocation')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      "Reassign a lead's screener/credit/disbursal owner outside the normal workflow",
  })
  overrideAllocation(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: AllocationOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.overrideAllocation(leadId, dto, user.sub);
  }

  @Patch('personal-detail')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: "Override a lead's personal/customer details" })
  overridePersonalDetail(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpsertLeadCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.overridePersonalDetail(leadId, dto, user.sub);
  }

  @Patch('employment-detail')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: "Override a lead's employment details" })
  overrideEmploymentDetail(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpsertLeadEmploymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.overrideEmploymentDetail(leadId, dto, user.sub);
  }

  @Post('bank-detail')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Add/correct a bank detail record for a lead' })
  overrideBankDetail(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCustomerBankingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.overrideBankDetail(leadId, dto, user.sub);
  }

  @Patch('cam-detail')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: "Override a lead's CAM (credit analysis memo) details",
  })
  overrideCamDetail(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpsertCamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supportService.overrideCamDetail(leadId, dto, user.sub);
  }
}
