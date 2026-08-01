import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CamService } from './cam.service';
import { SendBackCamDto } from './dto/send-back-cam.dto';
import { UpsertCamDto } from './dto/upsert-cam.dto';

@ApiTags('CAM')
@ApiCookieAuth()
@Controller('leads/:leadId/cam')
export class CamController {
  constructor(private readonly camService: CamService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Get the Credit Appraisal Memo (CAM) for a lead' })
  findByLead(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.camService.findByLead(leadId);
  }

  @Put()
  @Roles('CR2', 'CR3')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Create or update the CAM (sanction terms and risk appraisal) for a lead',
  })
  upsert(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpsertCamDto,
  ) {
    return this.camService.upsert(leadId, dto);
  }

  @Post('sanction')
  @Roles('CR2', 'CR3')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Sanction the CAM for a lead' })
  sanction(
    @Param('leadId', ParseIntPipe) leadId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.camService.sanction(leadId, user.sub);
  }

  @Post('send-back')
  @Roles('CR2', 'CR3')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Send the CAM back for revision with remarks' })
  sendBack(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: SendBackCamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.camService.sendBack(leadId, dto, user.sub);
  }
}
