import { Body, Controller, ParseIntPipe, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InitiateEsignDto } from './dto/initiate-esign.dto';
import { EsignService } from './esign.service';

@ApiTags('eSign')
@ApiCookieAuth()
@Controller('esign')
export class EsignController {
  constructor(private readonly esignService: EsignService) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Initiate a Signzy Aadhaar eSign contract for a document',
  })
  @ApiResponse({ status: 201, description: 'eSign contract initiation logged' })
  initiate(@Body() dto: InitiateEsignDto) {
    return this.esignService.initiateContract(dto);
  }

  @Post('download')
  @ApiOperation({
    summary:
      'Download the signed document for a previously-initiated eSign contract',
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  download(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.esignService.downloadSignedDocument(leadId);
  }
}
