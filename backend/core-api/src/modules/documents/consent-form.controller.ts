import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConsentFormService } from './consent-form.service';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('leads/:leadId/consent-form')
export class ConsentFormController {
  constructor(private readonly consentFormService: ConsentFormService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      "Render the Key Fact Statement consent form PDF for a lead's current CAM terms",
  })
  async download(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.consentFormService.generate(leadId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="consent-form-lead-${leadId}.pdf"`,
    });
    res.send(pdf);
  }
}
