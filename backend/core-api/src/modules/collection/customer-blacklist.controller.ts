import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CollectionService } from './collection.service';
import { CreateCustomerBlacklistDto } from './dto/create-customer-blacklist.dto';

@ApiTags('Customer Blacklist')
@ApiCookieAuth()
@Controller('leads/:leadId/blacklist')
export class CustomerBlacklistController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List blacklist entries for a lead/customer' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.collectionService.listBlacklistEntries(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Blacklist a customer/lead with a reason' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCustomerBlacklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.blacklistLead(leadId, dto, user.sub);
  }
}
