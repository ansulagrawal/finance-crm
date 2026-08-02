import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
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
import { CollectionService } from './collection.service';
import { AssignCollectionVisitDto } from './dto/assign-collection-visit.dto';
import { CreateCollectionVisitDto } from './dto/create-collection-visit.dto';
import { UpdateCollectionVisitStatusDto } from './dto/update-collection-visit-status.dto';

@ApiTags('Collection Visits')
@ApiCookieAuth()
@Controller('leads/:leadId/collection-visits')
export class CollectionVisitsController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List collection field visits for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.collectionService.listVisits(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Schedule a collection field visit for a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCollectionVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.createVisit(leadId, dto, user.sub);
  }

  @Patch(':visitId/assign')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'visitId',
    description: 'Collection visit ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Assign a collection visit to a field agent' })
  assign(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: AssignCollectionVisitDto,
  ) {
    return this.collectionService.assignVisit(leadId, visitId, dto);
  }

  @Patch(':visitId/status')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'visitId',
    description: 'Collection visit ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Update the status of a collection visit' })
  updateStatus(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: UpdateCollectionVisitStatusDto,
  ) {
    return this.collectionService.updateVisitStatus(leadId, visitId, dto);
  }
}
