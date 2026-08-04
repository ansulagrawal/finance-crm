import { findOrFail } from '@finance-crm/common';
import {
  Lead,
  Loan,
  RepaymentApiStatus,
  RepaymentLog,
  RepaymentMethod,
  RepaymentProvider,
  RepaymentSource,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';

interface RazorpayPaymentLinkResponse {
  id: string;
  short_url: string;
  status: string;
}

/**
 * Razorpay Payment Links (loan-repayment collection), ported from
 * `old-php-files/components/includes/integration/payday_razorpay_api.php`.
 * Real endpoint: `POST https://api.razorpay.com/v1/payment_links/`, Basic
 * Auth with key:secret. Legacy hardcodes a LIVE key/secret in
 * `integration_config.php` — never copy those values here; this reads from
 * env vars only.
 *
 * Razorpay's role in the legacy app is COLLECTION only — it does not touch
 * disbursal payout, which stays on the existing direct-bank-transfer flow
 * (`DisbursementBank`/`DisbursementTransactionLog`).
 */
@Injectable()
export class RazorpayService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(RepaymentLog)
    private readonly repaymentLogRepository: Repository<RepaymentLog>,
  ) {}

  async createPaymentLink(dto: CreatePaymentLinkDto): Promise<RepaymentLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const loan = await this.loanRepository.findOne({
      where: { lead: { id: dto.leadId } },
    });
    if (!loan) {
      throw new BadRequestException(
        'Lead has no loan — cannot create a repayment link',
      );
    }
    const totalOutstanding = Number(loan.totalOutstanding ?? 0);
    if (totalOutstanding <= 0) {
      throw new BadRequestException('Loan has no outstanding amount');
    }

    const keyId = this.configService.getOrThrow<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.getOrThrow<string>(
      'RAZORPAY_KEY_SECRET',
    );
    const baseUrl = this.configService.get<string>(
      'RAZORPAY_API_URL',
      'https://api.razorpay.com/v1/payment_links/',
    );
    const callbackUrl = this.configService.getOrThrow<string>(
      'RAZORPAY_CALLBACK_URL',
    );

    const orderData = {
      amount: Math.round(totalOutstanding * 100),
      currency: 'INR',
      accept_partial: true,
      first_min_partial_amount: Math.round(dto.minPartialAmount * 100),
      expire_by: Math.floor(Date.now() / 1000) + 86400,
      reference_id: `${loan.loanNumber}_${Date.now()}`,
      description: 'Loan Repayment',
      customer: {
        name: lead.firstName,
        contact: lead.mobile,
        email: lead.email ?? undefined,
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      notes: { loan_id: loan.loanNumber },
      callback_url: callbackUrl,
      callback_method: 'get',
    };

    const requestedAt = new Date();
    // `method`/`source` are NOT NULL with no DB default (unlike the
    // pre-rewrite entity, which allowed both to be omitted) — a Payment
    // Link is legacy's "LINK" method, staff-generated from the CRM (not a
    // customer-facing website checkout, hence not `WEBSITE`).
    const log = this.repaymentLogRepository.create({
      lead,
      provider: RepaymentProvider.RAZORPAY,
      method: RepaymentMethod.LINK,
      source: RepaymentSource.EXECUTIVE_LINK,
      loanNumber: loan.loanNumber,
      request: JSON.stringify(orderData),
      amount: totalOutstanding,
      requestedAt,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<RazorpayPaymentLinkResponse>(baseUrl, orderData, {
          auth: { username: keyId, password: keySecret },
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      log.response = JSON.stringify(response.data);
      log.orderId = response.data.id;
      log.status = RepaymentApiStatus.SUCCESS;
      log.respondedAt = new Date();
    } catch (error) {
      log.status = RepaymentApiStatus.CONN_ERROR;
      log.errors = error instanceof Error ? error.message : 'Unknown error';
      log.respondedAt = new Date();
    }

    return this.repaymentLogRepository.save(log);
  }
}
