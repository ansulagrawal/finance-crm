import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectionService } from './collection.service';
import { FollowupTemplateTypeQueryDto } from './dto/followup-template-type-query.dto';

@ApiTags('Collection Lookups')
@ApiCookieAuth()
@Controller()
export class CollectionLookupsController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get('payment-modes')
  @ApiOperation({ summary: 'List payment mode lookup values' })
  listPaymentModes() {
    return this.collectionService.listPaymentModes();
  }

  @Get('followup-types')
  @ApiOperation({ summary: 'List collection followup type lookup values' })
  listFollowupTypes() {
    return this.collectionService.listFollowupTypes();
  }

  @Get('followup-statuses')
  @ApiOperation({ summary: 'List collection followup status lookup values' })
  listFollowupStatuses() {
    return this.collectionService.listFollowupStatuses();
  }

  @Get('blacklist-reasons')
  @ApiOperation({ summary: 'List customer blacklist reason lookup values' })
  listBlacklistReasons() {
    return this.collectionService.listBlacklistReasons();
  }

  @Get('followup-templates')
  @ApiOperation({
    summary:
      'List collection followup SMS/email templates for a given type (2=SMS, 3=WhatsApp, 4=Email). WhatsApp always returns empty — never implemented in legacy.',
  })
  listFollowupTemplates(@Query() query: FollowupTemplateTypeQueryDto) {
    return this.collectionService.listFollowupTemplates(query.typeId);
  }
}
