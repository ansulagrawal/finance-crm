import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeclareLeadAllocationDto } from './dto/declare-lead-allocation.dto';
import { LeadAllocationService } from './lead-allocation.service';

@ApiTags('Lead Allocation')
@ApiCookieAuth()
@Roles('CR1', 'CR2')
@Controller('lead-allocation')
export class LeadAllocationController {
  constructor(private readonly leadAllocationService: LeadAllocationService) {}

  @Post()
  @ApiOperation({
    summary:
      "Declare today's lead-allocation availability (active/inactive, fresh/repeat)",
  })
  declare(
    @Body() dto: DeclareLeadAllocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadAllocationService.declare(dto, user.sub);
  }

  @Get('today')
  @ApiOperation({ summary: "Get the acting user's latest declaration today" })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.leadAllocationService.getToday(user.sub);
  }
}
