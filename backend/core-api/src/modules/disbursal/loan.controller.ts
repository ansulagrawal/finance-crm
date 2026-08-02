import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { DisbursalService } from './disbursal.service';
import { CreateDisbursementTransactionDto } from './dto/create-disbursement-transaction.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';

@ApiTags('Loan')
@ApiCookieAuth()
@Controller('leads/:leadId/loan')
export class LoanController {
  constructor(private readonly disbursalService: DisbursalService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Get the loan record for a lead' })
  findByLead(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.disbursalService.findLoanByLead(leadId);
  }

  @Post()
  @Roles('DS1', 'DS2')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Create a loan record for a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateLoanDto,
  ) {
    return this.disbursalService.createLoan(leadId, dto);
  }

  @Post('disburse')
  @Roles('DS1', 'DS2')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Disburse the loan to the customer bank account. paymentMode ONLINE sends a real IMPS transfer via ICICI and MOVES MONEY; OFFLINE records a transfer a human already made.',
  })
  disburse(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: DisburseLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Acting user is recorded on the transaction log — for a money-moving
    // action, who triggered it is part of the audit trail, not optional.
    return this.disbursalService.disburse(leadId, dto, user.sub);
  }

  @Patch('settle')
  @Roles('SA', 'CA')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Mark the loan as settled directly, bypassing payment reconciliation ' +
      '- admin-only manual override; the normal path is verifying a ' +
      'Settle-type payment via POST .../payments/:id/verify, which validates ' +
      'the amount reconciles first',
  })
  settle(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.disbursalService.settle(leadId);
  }

  @Patch('close')
  @Roles('SA', 'CA')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Close the loan directly, bypassing payment reconciliation - ' +
      'admin-only manual override; see the settle endpoint doc for why',
  })
  close(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.disbursalService.close(leadId);
  }

  @Patch('write-off')
  @Roles('SA', 'CA')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Write off the loan directly, bypassing payment reconciliation - ' +
      'admin-only manual override; see the settle endpoint doc for why',
  })
  writeOff(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.disbursalService.writeOff(leadId);
  }

  @Get('transactions')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List disbursement transactions for the loan' })
  listTransactions(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.disbursalService.listTransactions(leadId);
  }

  @Post('transactions')
  @Roles('DS1', 'DS2')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Record a disbursement transaction for the loan' })
  createTransaction(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateDisbursementTransactionDto,
  ) {
    return this.disbursalService.createTransaction(leadId, dto);
  }

  @Delete('transactions/:transactionId')
  @Roles('DS1', 'DS2')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'transactionId',
    description: 'Disbursement transaction log ID',
    type: Number,
  })
  @ApiOperation({
    summary:
      'Soft-delete a disbursement transaction log (only while the lead is active and not yet disbursed)',
  })
  removeTransaction(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ) {
    return this.disbursalService.removeTransaction(leadId, transactionId);
  }
}
