import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
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
import { CollectionService } from './collection.service';
import { CreateCollectionFollowupDto } from './dto/create-collection-followup.dto';
import { FollowupTemplateTypeQueryDto } from './dto/followup-template-type-query.dto';

@ApiTags('Collection Followups')
@ApiCookieAuth()
@Controller('leads/:leadId/collection-followups')
export class CollectionFollowupsController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List collection followup entries for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.collectionService.listFollowups(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Add a collection followup entry for a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCollectionFollowupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.createFollowup(leadId, dto, user.sub);
  }

  @Get('templates/:templateId')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'templateId',
    description: 'SMS/email template ID',
    type: Number,
  })
  @ApiOperation({
    summary:
      "Render a collection followup SMS/email template with this lead's real merge-field values",
  })
  renderTemplateContent(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Query() query: FollowupTemplateTypeQueryDto,
  ) {
    return this.collectionService.renderFollowupTemplateContent(
      leadId,
      templateId,
      query.typeId,
    );
  }
}
