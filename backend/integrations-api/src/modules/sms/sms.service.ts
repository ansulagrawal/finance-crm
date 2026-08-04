import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, Lead, SmsLog } from '@finance-crm/database';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SendGenericSmsDto } from './dto/send-generic-sms.dto';
import { SendOtpSmsDto } from './dto/send-otp-sms.dto';
import type { SmsSender } from './senders/sms-sender.interface';
import { SMS_SENDER } from './sms.tokens';

/**
 * Real, currently-active OTP SMS template, ported verbatim from
 * `components/includes/integration/payday_sms_sent_api.php`
 * (`routemobile_sms_sent_api_call()`, `sms_type_id == 1`) — the only SMS
 * type with a live, non-commented-out code path. DLT template id/sender
 * id kept identical (`1107176535879044251` / `acme`). Send mechanism is
 * pluggable via `SMS_PROVIDER` (see `SmsModule`).
 */
const OTP_TEMPLATE_ID = '1107176535879044251';
const OTP_TEMPLATE_SOURCE = 'acme';

function buildOtpMessage(otp: string): string {
  return `${otp} is your OTP. Valid for 10 min. Please Do not share with anyone. Acme Leasing & Finance Pvt Ltd`;
}

@Injectable()
export class SmsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(SmsLog)
    private readonly smsLogRepository: Repository<SmsLog>,
    @Inject(SMS_SENDER)
    private readonly smsSender: SmsSender,
  ) {}

  async sendOtp(dto: SendOtpSmsDto): Promise<SmsLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const message = buildOtpMessage(dto.otp);

    return this.send(lead, {
      mobile: dto.mobile,
      message,
      templateId: OTP_TEMPLATE_ID,
      templateSource: OTP_TEMPLATE_SOURCE,
      typeId: 1,
    });
  }

  /**
   * General-purpose send, for callers (`automation-worker`'s cron jobs)
   * that compose their own message/templateId rather than needing a
   * dedicated `integrations-api` template — same "generic transactional
   * endpoint" pattern as `EmailModule`'s `POST /email/send`. Unblocks
   * `RepaymentReminderSmsService`, which previously had no real SMS-send
   * endpoint to call and substituted a WhatsApp template instead.
   */
  async sendGenericSms(dto: SendGenericSmsDto): Promise<SmsLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    return this.send(lead, {
      mobile: dto.mobile,
      message: dto.message,
      templateId: dto.templateId,
      templateSource: null,
      typeId: dto.typeId,
    });
  }

  private async send(
    lead: Lead,
    params: {
      mobile: string;
      message: string;
      templateId: string;
      templateSource: string | null;
      typeId: number;
    },
  ): Promise<SmsLog> {
    const result = await this.smsSender.send({
      mobile: params.mobile,
      message: params.message,
      templateId: params.templateId,
    });

    const log = this.smsLogRepository.create({
      lead,
      typeId: params.typeId,
      mobile: params.mobile,
      content: params.message,
      templateId: params.templateId,
      templateSource: params.templateSource,
      apiStatus: result.success
        ? ApiCallStatus.SUCCESS
        : result.isNetworkError
          ? ApiCallStatus.NETWORK_ERROR
          : ApiCallStatus.API_ERROR,
      apiResponse: result.responseBody,
      errors: result.errorMessage,
      // SmsLog (api_sms_logs) has no requestedAt/respondedAt pair, only a
      // single createdAt — unlike the pre-rewrite entity this was ported
      // from.
      createdAt: new Date(),
    });
    return this.smsLogRepository.save(log);
  }
}
