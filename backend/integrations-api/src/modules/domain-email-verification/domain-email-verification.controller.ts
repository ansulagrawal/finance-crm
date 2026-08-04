import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DomainEmailVerificationService } from './domain-email-verification.service';
import { VerifyDomainDto } from './dto/verify-domain.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Domain Email Verification')
@ApiCookieAuth()
@Controller()
export class DomainEmailVerificationController {
  constructor(private readonly service: DomainEmailVerificationService) {}

  @Post('domain-verification')
  @ApiOperation({
    summary:
      "Verify an email's domain registration via Signzy domainVerificationLite",
  })
  @ApiResponse({
    status: 201,
    description: 'Domain verification result logged',
  })
  verifyDomain(@Body() dto: VerifyDomainDto) {
    return this.service.verifyDomain(dto);
  }

  @Post('email-verification')
  @ApiOperation({
    summary:
      'Verify email deliverability/validity via Signzy email verificationV2',
  })
  @ApiResponse({ status: 201, description: 'Email verification result logged' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.service.verifyEmail(dto);
  }
}
