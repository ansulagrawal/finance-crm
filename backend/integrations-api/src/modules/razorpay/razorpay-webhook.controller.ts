import { Public } from '@finance-crm/common';
import { RepaymentApiStatus, RepaymentLog } from '@finance-crm/database';
import type { RawBodyRequest } from '@nestjs/common';
import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import type { Repository } from 'typeorm';
import { verifyRazorpaySignature } from './razorpay-webhook.util';

/**
 * Third-party-initiated webhook — authenticated via the `x-razorpay-signature`
 * header (HMAC verified against `RAZORPAY_WEBHOOK_SECRET`), not the cookie
 * session used by staff-facing routes. Marked `@Public()` accordingly.
 */
@ApiTags('Razorpay')
@Controller('razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RepaymentLog)
    private readonly repaymentLogRepository: Repository<RepaymentLog>,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Razorpay payment-link webhook callback (HMAC signature-authenticated via x-razorpay-signature, not cookie auth)',
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): Promise<{ status: string }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    const secret = this.configService.getOrThrow<string>(
      'RAZORPAY_WEBHOOK_SECRET',
    );

    if (!verifyRazorpaySignature(rawBody, signature, secret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf-8'));
    const orderId: string | undefined =
      payload?.payload?.payment_link?.entity?.id;
    const event: string | undefined = payload?.event;

    if (orderId) {
      const log = await this.repaymentLogRepository.findOne({
        where: { orderId },
        order: { id: 'DESC' },
      });
      if (log) {
        log.response = JSON.stringify(payload);
        log.status =
          event === 'payment_link.paid'
            ? RepaymentApiStatus.SUCCESS
            : log.status;
        log.respondedAt = new Date();
        await this.repaymentLogRepository.save(log);
      }
    }

    return { status: 'ok' };
  }
}
