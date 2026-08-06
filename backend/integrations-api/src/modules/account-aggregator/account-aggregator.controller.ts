import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AccountAggregatorService } from './account-aggregator.service';
import { RequestConsentDto } from './dto/request-consent.dto';
import { RequestFiDto } from './dto/request-fi.dto';

@ApiTags('Account Aggregator')
@ApiCookieAuth()
@Controller('account-aggregator')
export class AccountAggregatorController {
  constructor(
    private readonly accountAggregatorService: AccountAggregatorService,
  ) {}

  @Post('consent-request')
  @ApiOperation({
    summary:
      'LEGACY flow: request AA consent from the customer for a bank statement pull (5-step Finvu-shaped flow)',
  })
  requestConsent(@Body() dto: RequestConsentDto) {
    return this.accountAggregatorService.requestConsent(dto);
  }

  @Post('leads/:leadId/np-consent-request')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'NOVEL_PATTERN flow: request AA consent via CartBI (single request, async webhook callback delivers the result)',
  })
  createConsentRequestNp(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.accountAggregatorService.createConsentRequestNp(leadId);
  }

  @Get('leads/:leadId/consent-status')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: "Poll the status of a lead's AA consent request" })
  getConsentStatus(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.accountAggregatorService.getConsentStatus(leadId);
  }

  @Post('leads/:leadId/fi-request')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary: 'Request the Financial Information (bank statement) pull',
  })
  requestFi(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: RequestFiDto,
  ) {
    return this.accountAggregatorService.requestFi(leadId, dto);
  }

  @Get('leads/:leadId/fi-status')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: "Poll the status of a lead's FI request" })
  getFiStatus(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.accountAggregatorService.getFiStatus(leadId);
  }

  @Get('leads/:leadId/fi-data')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Fetch the pulled bank-statement transactions plus a year/month summary (credits/debits/net change)',
  })
  fetchFiData(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.accountAggregatorService.fetchFiData(leadId);
  }

  @Get('leads/:leadId/analytics-report')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Fetch the vendor bank-analysis report for a lead' })
  getAnalyticsReport(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.accountAggregatorService.getAnalyticsReport(leadId);
  }
}
