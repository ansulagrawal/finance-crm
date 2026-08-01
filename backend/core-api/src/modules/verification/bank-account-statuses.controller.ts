import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VerificationService } from './verification.service';

@ApiTags('Bank Account Statuses')
@ApiCookieAuth()
@Controller('bank-account-statuses')
export class BankAccountStatusesController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List bank account verification status lookup values',
  })
  list() {
    return this.verificationService.listBankAccountStatuses();
  }
}
