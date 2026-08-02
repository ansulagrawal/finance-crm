import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { LegalNoticeService } from './legal-notice.service';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('leads/:leadId/legal-notice')
export class LegalNoticeController {
  constructor(private readonly legalNoticeService: LegalNoticeService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Render the legal-notice PDF for a lead — PLACEHOLDER CONTENT, NOT LEGAL-REVIEWED, see the template doc comment before using this for a real borrower',
  })
  async download(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.legalNoticeService.generate(leadId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="legal-notice-lead-${leadId}.pdf"`,
    });
    res.send(pdf);
  }
}
