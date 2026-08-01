import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCustomerBankingDto } from './dto/create-customer-banking.dto';
import { SetBankAccountStatusDto } from './dto/set-bank-account-status.dto';
import { VerificationService } from './verification.service';

@ApiTags('Customer Banking')
@ApiCookieAuth()
@Controller('leads/:leadId/banking')
export class CustomerBankingController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List bank account records for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.verificationService.listBanking(leadId);
  }

  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Add a bank account record for a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCustomerBankingDto,
  ) {
    return this.verificationService.createBanking(leadId, dto);
  }

  @Patch(':bankingId/verify')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'bankingId',
    description: 'Customer banking record ID',
    type: Number,
  })
  @ApiOperation({ summary: 'Mark a bank account record as verified' })
  verify(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('bankingId', ParseIntPipe) bankingId: number,
  ) {
    return this.verificationService.verifyBanking(leadId, bankingId);
  }

  @Patch(':bankingId/status')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'bankingId',
    description: 'Customer banking record ID',
    type: Number,
  })
  @ApiOperation({
    summary:
      'Set a bank account record to any master_bank_account_status value',
  })
  setStatus(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('bankingId', ParseIntPipe) bankingId: number,
    @Body() dto: SetBankAccountStatusDto,
  ) {
    return this.verificationService.setBankAccountStatus(
      leadId,
      bankingId,
      dto.accountStatusId,
    );
  }
}
