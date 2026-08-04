import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SendGenericSmsDto } from './dto/send-generic-sms.dto';
import { SendOtpSmsDto } from './dto/send-otp-sms.dto';
import { SmsService } from './sms.service';

@ApiTags('SMS')
@ApiCookieAuth()
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('otp')
  @ApiOperation({ summary: 'Send an OTP SMS via the Vapio SMS gateway' })
  @ApiResponse({ status: 201, description: 'OTP SMS send attempt logged' })
  sendOtp(@Body() dto: SendOtpSmsDto) {
    return this.smsService.sendOtp(dto);
  }

  @Post('send')
  @ApiOperation({
    summary:
      'Send an arbitrary SMS message to a lead via Vapio (for callers with their own template content)',
  })
  @ApiResponse({ status: 201, description: 'SMS send attempt logged' })
  sendGeneric(@Body() dto: SendGenericSmsDto) {
    return this.smsService.sendGenericSms(dto);
  }
}
