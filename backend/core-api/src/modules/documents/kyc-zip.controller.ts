import { Roles } from '@finance-crm/common';
import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { KycZipService } from './kyc-zip.service';

// Legacy (`Admin/KycZipController.php:21,31`) restricts this to `agent ==
// 'LD1'` only — no other role, not even 'CA'. This controller had no role
// gate at all until now, meaning any authenticated user could download
// every KYC document for any lead.
@ApiTags('Documents')
@ApiCookieAuth()
@Roles('LD1')
@Controller('leads/:leadId/documents/kyc-zip')
export class KycZipController {
  constructor(private readonly kycZipService: KycZipService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiProduces('application/zip')
  @ApiOperation({
    summary: 'Download a zip of every KYC document uploaded for a lead',
  })
  async download(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Res() res: Response,
  ): Promise<void> {
    const zip = await this.kycZipService.buildZip(leadId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="lead-${leadId}-kyc-docs.zip"`,
    });
    res.send(zip);
  }
}
