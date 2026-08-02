import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SanctionLetterService } from './sanction-letter.service';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('leads/:leadId/sanction-letter')
export class SanctionLetterController {
  constructor(private readonly sanctionLetterService: SanctionLetterService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Render the Key Fact Statement + Loan Agreement PDF for a sanctioned lead, for the frontend to display/print',
  })
  async download(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.sanctionLetterService.generate(leadId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sanction-letter-lead-${leadId}.pdf"`,
    });
    res.send(pdf);
  }
}
