import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LeadLookupsService } from './lead-lookups.service';

@ApiTags('Lead Lookups')
@ApiCookieAuth()
@Controller()
export class LeadLookupsController {
  constructor(private readonly leadLookupsService: LeadLookupsService) {}

  @Get('marital-statuses')
  @ApiOperation({ summary: 'List marital status lookup values' })
  listMaritalStatuses() {
    return this.leadLookupsService.listMaritalStatuses();
  }

  @Get('qualifications')
  @ApiOperation({ summary: 'List qualification lookup values' })
  listQualifications() {
    return this.leadLookupsService.listQualifications();
  }

  @Get('occupations')
  @ApiOperation({ summary: 'List occupation lookup values' })
  listOccupations() {
    return this.leadLookupsService.listOccupations();
  }

  @Get('religions')
  @ApiOperation({ summary: 'List religion lookup values' })
  listReligions() {
    return this.leadLookupsService.listReligions();
  }

  @Get('rejection-reasons')
  @ApiOperation({ summary: 'List lead rejection reason lookup values' })
  listRejectionReasons() {
    return this.leadLookupsService.listRejectionReasons();
  }

  @Get('master-statuses')
  @ApiOperation({
    summary:
      'List the lead/loan lifecycle status lookup values (name + stageCode), ordered for display. ' +
      'Optionally filtered to a single stageCode - e.g. ?stage=S16 for the curated Collection ' +
      "repayment-type dropdown, matching legacy's own status_stage='S16' filter " +
      '(`CollectionController::paymentHistory()`).',
  })
  @ApiQuery({ name: 'stage', required: false, example: 'S16' })
  listMasterStatuses(@Query('stage') stage?: string) {
    return this.leadLookupsService.listMasterStatuses(stage);
  }
}
