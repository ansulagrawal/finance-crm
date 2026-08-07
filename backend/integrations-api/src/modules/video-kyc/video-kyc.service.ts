import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  Lead,
  VideoKycLog,
  VideoKycMethod,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { CreateVideoKycSessionDto } from './dto/create-video-kyc-session.dto';

const SIGNZY_PROVIDER = 1;

/** Signzy ConsenzAI video KYC — ports `payday_video_kyc_api.php`
 * (`video_kyc_create_url`), `POST v3/consenzAI/createUrl`, with a scripted
 * loan-consent statement read aloud by the customer during the session. */
@Injectable()
export class VideoKycService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(VideoKycLog)
    private readonly logRepository: Repository<VideoKycLog>,
    private readonly signzy: SignzyClientService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(dto: CreateVideoKycSessionDto): Promise<VideoKycLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const callbackUrl = this.configService.get<string>('LMS_URL', '');
    const brand = this.configService.get<string>('BRAND_NAME', 'Finance CRM');

    const script =
      `I ${dto.customerFullName}, hereby confirm that I am willingly availing a loan of ` +
      `Rs.${dto.loanAmount.toFixed(2)} from ${brand}. I understand and agree that the loan amount ` +
      `will be repayable on ${dto.repaymentDate}, with a total repayment amount of ` +
      `Rs.${dto.repaymentAmount.toFixed(2)} as per the agreed terms and conditions.`;

    const result = await this.signzy.post('v3/consenzAI/createUrl', {
      hideBottomLogo: 'true',
      callbackUrl,
      redirectUrl: callbackUrl,
      accentColor: '#1F57E7',
      script,
      timer: 30,
    });
    const response = result.data as {
      requestId?: string;
      consumerId?: string;
      customerUrl?: string;
      videoUrl?: string;
    };
    const requestId = response?.requestId ?? response?.consumerId ?? null;
    const url = response?.customerUrl ?? response?.videoUrl ?? null;

    const log = this.logRepository.create({
      lead,
      provider: SIGNZY_PROVIDER,
      method: VideoKycMethod.REQUEST,
      requestId,
      request: result.requestJson,
      response: result.responseJson,
      returnUrl: url,
      status: url ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
