import { Controller, ParseIntPipe, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CallManagementService } from './call-management.service';

@ApiTags('Call Management (RUNO)')
@ApiCookieAuth()
@Controller('call-management')
export class CallManagementController {
  constructor(private readonly callManagementService: CallManagementService) {}

  @Post('runo/sanction-allocation')
  @ApiOperation({
    summary: "Allocate a lead's sanction-team call to RUNO's dialer",
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  allocateSanctionCall(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.callManagementService.allocateSanctionCall(leadId);
  }
}
