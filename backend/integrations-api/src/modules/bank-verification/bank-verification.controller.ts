import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BankVerificationService } from './bank-verification.service';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';

@ApiTags('Bank Verification')
@ApiCookieAuth()
@Controller('bank-verification')
export class BankVerificationController {
  constructor(
    private readonly bankVerificationService: BankVerificationService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      "Run a Signzy penny-drop bank account verification for a lead's beneficiary details",
  })
  @ApiResponse({ status: 201, description: 'Bank verification result logged' })
  verify(@Body() dto: VerifyBankAccountDto) {
    return this.bankVerificationService.verify(dto);
  }
}
