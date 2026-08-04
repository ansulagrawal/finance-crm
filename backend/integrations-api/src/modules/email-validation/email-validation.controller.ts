import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateEmailDto } from './dto/validate-email.dto';
import { EmailValidationService } from './email-validation.service';

@ApiTags('Email Validation')
@ApiCookieAuth()
@Controller('email-validation')
export class EmailValidationController {
  constructor(
    private readonly emailValidationService: EmailValidationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Validate an email address via SendGrid' })
  validate(@Body() dto: ValidateEmailDto) {
    return this.emailValidationService.validate(dto);
  }
}
