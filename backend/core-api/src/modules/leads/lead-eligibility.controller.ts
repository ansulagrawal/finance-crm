import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LeadEligibilityService } from './lead-eligibility.service';

@ApiTags('Leads')
@ApiCookieAuth()
@Controller('leads/:leadId/check-eligibility')
export class LeadEligibilityController {
  constructor(
    private readonly leadEligibilityService: LeadEligibilityService,
  ) {}

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Re-run the lightweight eligibility pre-screen for a lead (ports check_customer_eligibility) — auto-rejects to SYSTEM-REJECT if it fails',
  })
  check(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.leadEligibilityService.evaluate(leadId);
  }
}
