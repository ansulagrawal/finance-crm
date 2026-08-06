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
import { BankAnalysisService } from './bank-analysis.service';
import { UploadBankAnalysisDto } from './dto/upload-bank-analysis.dto';

@ApiTags('Bank Analysis (CartBI)')
@ApiCookieAuth()
@Controller('bank-analysis')
export class BankAnalysisController {
  constructor(private readonly bankAnalysisService: BankAnalysisService) {}

  @Post('upload')
  @ApiOperation({
    summary:
      "Upload a lead's BANK STATEMENT document to CartBI for fraud-score/average-balance analysis",
  })
  upload(@Body() dto: UploadBankAnalysisDto) {
    return this.bankAnalysisService.upload(dto);
  }

  @Get('leads/:leadId/result')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      "Fetch a lead's parsed CartBI bank-analysis result (fraud score, account details, average balances) once the async callback has completed",
  })
  getResult(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.bankAnalysisService.getResult(leadId);
  }
}
