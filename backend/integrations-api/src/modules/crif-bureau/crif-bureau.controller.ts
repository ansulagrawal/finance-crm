import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CrifBureauService } from './crif-bureau.service';
import { FetchCrifReportDto } from './dto/fetch-crif-report.dto';
import { InitiateCrifSignzyDto } from './dto/initiate-crif-signzy.dto';

@ApiTags('CRIF Bureau')
@ApiCookieAuth()
@Controller('crif-bureau')
export class CrifBureauController {
  constructor(private readonly crifBureauService: CrifBureauService) {}

  @Post('report')
  @ApiOperation({
    summary: 'Trigger a Surepass CRIF bureau credit report pull for a PAN',
  })
  @ApiResponse({ status: 201, description: 'CRIF bureau report fetch logged' })
  fetchReport(@Body() dto: FetchCrifReportDto) {
    return this.crifBureauService.fetchReport(dto);
  }

  @Post('signzy-report')
  @ApiOperation({
    summary:
      'Trigger the Signzy CRIF passthrough (dormant in legacy — Surepass is the live default)',
  })
  @ApiResponse({
    status: 201,
    description: 'CRIF bureau consent flow attempted via Signzy',
  })
  fetchReportViaSignzy(@Body() dto: InitiateCrifSignzyDto) {
    return this.crifBureauService.fetchReportViaSignzy(dto);
  }

  @Get('report/:leadId')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      "Download the lead's most recent successful CRIF bureau report PDF (Surepass's own rendered report)",
  })
  async downloadReport(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.crifBureauService.getReportBytes(leadId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="crif-report-lead-${leadId}.pdf"`,
    });
    res.send(pdf);
  }
}
