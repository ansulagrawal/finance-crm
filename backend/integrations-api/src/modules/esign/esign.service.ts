import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  EsignLog,
  EsignMethod,
  EsignProvider,
  Lead,
} from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { InitiateEsignDto } from './dto/initiate-esign.dto';

/** Signzy eSign — ports `payday_aadhaar_esign_api.php`
 * (`esign_document_upload_api_call` → `POST v3/contract/initiate`, then
 * `esign_aadhaar_download_api_call` → `POST v3/contract/pullData`).
 * Method ids kept identical to legacy (1=initiate, 3=download). */
@Injectable()
export class EsignService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(EsignLog)
    private readonly esignLogRepository: Repository<EsignLog>,
    private readonly signzy: SignzyClientService,
    private readonly configService: ConfigService,
  ) {}

  async initiateContract(dto: InitiateEsignDto): Promise<EsignLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const redirectBase = this.configService.get<string>('LMS_URL', '');

    const body = {
      pdf: dto.documentBase64,
      contractName: 'Esign Letter',
      contractExecuterName: 'Signzy',
      successRedirectUrl: `${redirectBase}/sanction-esign-response?lead_id=${dto.leadId}`,
      failureRedirectUrl: `${redirectBase}/`,
      contractTtl: 10_000,
      eSignProvider: 'eMudhra',
      nameMatchThreshold: '0.50',
      allowSignerGenderMatch: true,
      allowSignerYOBMatch: true,
      allowUidLastFourDigitsMatch: true,
      signerdetail: [
        {
          signerName: dto.signerName,
          signerMobile: dto.signerMobile,
          signerEmail: dto.signerEmail,
          signerGender: dto.signerGender ?? '',
          uidLastFourDigits: dto.aadhaarLastFourDigits,
          signerYearOfBirth: dto.signerYearOfBirth ?? '',
          signatureType: 'AADHAARESIGN-OTP',
          signatures: [{ pageNo: ['All'], signaturePosition: ['BottomLeft'] }],
        },
      ],
      workflow: true,
      isParallel: false,
      redirectTime: 5,
      locationCaptureMethod: 'ip',
      initiationEmailSubject: 'Please sign the document received on your email',
      customerMailList: [dto.signerEmail],
      emailPdfCustomNameFormat: 'SIGNERNAME',
    };

    const result = await this.signzy.post('v3/contract/initiate', body);
    const response = result.data as {
      customerId?: string;
      signerdetail?: Array<{ workflowUrl?: string }>;
    };
    const workflowUrl = response?.signerdetail?.[0]?.workflowUrl ?? null;

    const log = this.esignLogRepository.create({
      lead,
      method: EsignMethod.UPLOAD_DOCUMENT,
      provider: EsignProvider.SIGNZY,
      aadhaarNo: dto.aadhaarLastFourDigits,
      request: result.requestJson,
      response: result.responseJson,
      status:
        response?.customerId && workflowUrl
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnUrl: workflowUrl,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.esignLogRepository.save(log);
  }

  async downloadSignedDocument(leadId: number): Promise<EsignLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const initiateLog = await this.esignLogRepository.findOne({
      where: { lead: { id: leadId }, method: EsignMethod.UPLOAD_DOCUMENT },
      order: { id: 'DESC' },
    });
    if (!initiateLog) {
      throw new BadRequestException(
        'No eSign contract initiated for this lead — call initiateContract first',
      );
    }

    const result = await this.signzy.post('v3/contract/pullData', {});
    const response = result.data as {
      finalSignedContract?: string;
      auditCertificateUrl?: string;
    };

    const log = this.esignLogRepository.create({
      lead,
      method: EsignMethod.DOWNLOAD_DOCS,
      provider: EsignProvider.SIGNZY,
      request: result.requestJson,
      response: result.responseJson,
      status: response?.finalSignedContract
        ? ApiCallStatus.SUCCESS
        : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnUrl: response?.finalSignedContract ?? null,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.esignLogRepository.save(log);
  }
}
