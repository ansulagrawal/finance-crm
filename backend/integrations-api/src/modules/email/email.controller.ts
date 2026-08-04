import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SendGenericEmailDto } from './dto/send-generic-email.dto';
import { SendPasswordResetOtpEmailDto } from './dto/send-password-reset-otp-email.dto';
import { SendThankYouEmailDto } from './dto/send-thank-you-email.dto';
import { EmailService } from './email.service';

@ApiTags('Email')
@ApiCookieAuth()
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('thank-you')
  @ApiOperation({
    summary: "Send a lead's application thank-you email via SMTP",
  })
  @ApiResponse({
    status: 201,
    description: 'Thank-you email send attempt logged',
  })
  sendThankYou(@Body() dto: SendThankYouEmailDto) {
    return this.emailService.sendThankYouEmail(dto);
  }

  @Post('password-reset-otp')
  @ApiOperation({
    summary:
      'Send a staff password-reset OTP email. No leadId — staff mail is not lead-scoped. Called by core-api over the signed internal path.',
  })
  @ApiResponse({ status: 201, description: 'OTP email send attempt logged' })
  sendPasswordResetOtp(@Body() dto: SendPasswordResetOtpEmailDto) {
    return this.emailService.sendPasswordResetOtpEmail(dto);
  }

  @Post('send')
  @ApiOperation({
    summary:
      'Send an arbitrary subject/HTML email to a lead (for callers with their own template content)',
  })
  @ApiResponse({ status: 201, description: 'Email send attempt logged' })
  sendGeneric(@Body() dto: SendGenericEmailDto) {
    return this.emailService.sendGenericEmail(dto);
  }
}
