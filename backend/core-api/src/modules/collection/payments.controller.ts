import type { AuthenticatedUser } from '@finance-crm/common';
import { CurrentUser, Roles } from '@finance-crm/common';
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
import {
  CollectionService,
  PAYMENT_REMARKS_REQUIRED_ROLES,
  PAYMENT_VERIFIER_ROLE,
} from './collection.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@ApiTags('Payments')
@ApiCookieAuth()
@Controller('leads/:leadId/payments')
export class PaymentsController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List payments recorded for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.collectionService.listPayments(leadId);
  }

  @Get('repayment-details')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Loan-closure reconciliation preview — the same figures verifyPayment() validates a Full-Payment/Settle/Writeoff against',
  })
  repaymentDetails(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.collectionService.calculateRepaymentDetails(leadId);
  }

  @Post()
  @Roles(...PAYMENT_REMARKS_REQUIRED_ROLES)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'Record a payment against a lead' })
  create(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.createPayment(
      leadId,
      dto,
      user.sub,
      user.roles,
    );
  }

  @Patch(':paymentId/verify')
  @Roles(PAYMENT_VERIFIER_ROLE)
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({ name: 'paymentId', description: 'Payment ID', type: Number })
  @ApiOperation({ summary: 'Verify a recorded payment' })
  verify(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.collectionService.verifyPayment(
      leadId,
      paymentId,
      dto,
      user.sub,
      user.roles,
    );
  }
}
