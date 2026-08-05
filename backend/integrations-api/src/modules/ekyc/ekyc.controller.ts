import { Controller, ParseIntPipe, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EkycService } from './ekyc.service';

@ApiTags('eKYC')
@ApiCookieAuth()
@Controller('ekyc')
export class EkycController {
  constructor(private readonly ekycService: EkycService) {}

  @Post('digilocker/create-url')
  @ApiOperation({
    summary:
      'Create a Signzy Digilocker consent URL for a lead to complete eKYC',
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Digilocker create-URL request logged',
  })
  createUrl(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.ekycService.createDigilockerUrl(leadId);
  }

  @Post('digilocker/details')
  @ApiOperation({
    summary:
      "Fetch a lead's Digilocker user details after consent (requires a prior create-URL call)",
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  getDetails(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.ekycService.getDigilockerDetails(leadId);
  }

  @Post('digilocker/e-aadhaar')
  @ApiOperation({
    summary:
      "Fetch a lead's e-Aadhaar details from Digilocker (requires a prior create-URL call)",
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  getEaadhaar(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.ekycService.getEaadhaar(leadId);
  }

  @Post('digitap/digilocker/create-url')
  @ApiOperation({
    summary:
      'Create a Digitap Digilocker consent URL for a lead (alternate to Signzy)',
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  createDigitapDigilockerUrl(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.ekycService.createDigitapDigilockerUrl(leadId);
  }

  @Post('digitap/digilocker/details')
  @ApiOperation({
    summary:
      "Fetch a lead's Digitap Digilocker details after consent (requires a prior create-URL call)",
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  getDigitapDigilockerDetails(@Query('leadId', ParseIntPipe) leadId: number) {
    return this.ekycService.getDigitapDigilockerDetails(leadId);
  }

  @Post('digitap/ekyc/create-otp')
  @ApiOperation({ summary: 'Send an Aadhaar OTP via Digitap eKYC' })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiQuery({
    name: 'aadhaarNo',
    description: 'Full Aadhaar number',
    type: String,
  })
  createDigitapEkycOtp(
    @Query('leadId', ParseIntPipe) leadId: number,
    @Query('aadhaarNo') aadhaarNo: string,
  ) {
    return this.ekycService.createDigitapEkycOtp(leadId, aadhaarNo);
  }

  @Post('digitap/ekyc/submit-otp')
  @ApiOperation({
    summary:
      'Submit the Aadhaar OTP for a Digitap eKYC request (requires a prior create-otp call)',
  })
  @ApiQuery({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiQuery({
    name: 'otp',
    description: 'OTP received by the customer',
    type: String,
  })
  submitDigitapEkycOtp(
    @Query('leadId', ParseIntPipe) leadId: number,
    @Query('otp') otp: string,
  ) {
    return this.ekycService.submitDigitapEkycOtp(leadId, otp);
  }
}
