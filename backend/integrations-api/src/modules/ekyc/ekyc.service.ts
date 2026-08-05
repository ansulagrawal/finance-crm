import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  ApiProvider,
  EkycLog,
  Lead,
  LeadCustomer,
  Pincode,
} from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DigitapClientService } from '../digitap/digitap-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';

const DIGITAP_DIGILOCKER_CREATE_URL =
  'https://api.digitap.ai/ent/v1/kyc/generate-url';
const DIGITAP_DIGILOCKER_GET_DETAILS_URL =
  'https://api.digitap.ai/ent/v1/kyc/get-digilocker-details';
const DIGITAP_EKYC_CREATE_OTP_URL =
  'https://svc.digitap.ai/ent/v3/kyc/intiate-kyc-auto';
const DIGITAP_EKYC_SUBMIT_OTP_URL =
  'https://svc.digitap.ai/ent/v3/kyc/submit-otp';

/**
 * eKYC — ports `payday_aadhaar_digilocker_api.php`. Signzy Digilocker
 * (`digilocker_create_url_api_call`/`digilocker_get_details_api_call`/
 * `digilocker_get_eaadhaar_api_call`) is the default provider, method ids
 * kept identical to legacy (1=create URL, 2=get details, 4=get e-aadhaar).
 * Digitap Digilocker (`digitap_digilocker_create_url_api_call`/
 * `digitap_digilocker_get_details_api_call`) and Digitap eKYC OTP
 * (`digitap_ekyc_create_otp_api_call`/`digitap_ekyc_create_otp_api_success`)
 * are an alternate provider, distinguished by the `provider` column on
 * `EkycLog` (`'digitap'` vs null/`'signzy'`) since legacy runs both
 * concurrently rather than switching one out for the other.
 */
@Injectable()
export class EkycService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(EkycLog)
    private readonly ekycLogRepository: Repository<EkycLog>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly signzy: SignzyClientService,
    private readonly digitap: DigitapClientService,
    private readonly configService: ConfigService,
  ) {}

  async createDigilockerUrl(leadId: number): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');

    const redirectUrl = this.buildRedirectUrl(leadId);
    const body = {
      signup: true,
      redirectUrl,
      redirectTime: '1',
      callbackUrl: redirectUrl,
      successRedirectUrl: redirectUrl,
      successRedirectTime: '5',
      failureRedirectUrl: 'https://www.signzy.com/',
      failureRedirectTime: '5',
      logoVisible: 'true',
      supportEmailVisible: 'true',
      supportEmail: 'support@signzy.com',
      docType: ['PANCR', 'ADHAR'],
      purpose: 'kyc',
      getScope: true,
      consentValidTill: Math.floor(Date.now() / 1000) + 86_400,
      showLoaderState: true,
      companyName: 'Signzy',
    };

    const result = await this.signzy.post('v3/digilocker-v2/createUrl', body);
    const digilockerResult = (
      result.data as { result?: { requestId?: string; url?: string } }
    )?.result;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 1,
      request: result.requestJson,
      response: result.responseJson,
      status:
        digilockerResult?.requestId && digilockerResult?.url
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnUrl: digilockerResult?.url ?? null,
      returnRequestId: digilockerResult?.requestId ?? null,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  async getDigilockerDetails(leadId: number): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const createLog = await this.ekycLogRepository.findOne({
      where: { lead: { id: leadId }, methodId: 1 },
      order: { id: 'DESC' },
    });
    if (!createLog?.returnRequestId) {
      throw new BadRequestException(
        'No Digilocker create-URL request found for this lead — call createDigilockerUrl first',
      );
    }

    const result = await this.signzy.post('v3/digilocker-v2/getDetails', {
      requestId: createLog.returnRequestId,
    });
    const details = (
      result.data as { result?: { userDetails?: { digilockerid?: string } } }
    )?.result;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 2,
      request: result.requestJson,
      response: result.responseJson,
      status: details?.userDetails?.digilockerid
        ? ApiCallStatus.SUCCESS
        : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnRequestId: createLog.returnRequestId,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  async getEaadhaar(leadId: number): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const createLog = await this.ekycLogRepository.findOne({
      where: { lead: { id: leadId }, methodId: 1 },
      order: { id: 'DESC' },
    });
    if (!createLog?.returnRequestId) {
      throw new BadRequestException(
        'No Digilocker create-URL request found for this lead — call createDigilockerUrl first',
      );
    }

    const result = await this.signzy.post('v3/digilocker-v2/geteAadhaar', {
      requestId: createLog.returnRequestId,
      extraDigitalCertificateParams: true,
    });
    const details = (
      result.data as {
        result?: {
          uid?: string;
          dob?: string;
          address?: string;
          splitAddress?: {
            city?: string[];
            district?: string[];
            addressLine?: string;
            landMark?: string;
            pincode?: string;
          };
        };
      }
    )?.result;

    if (details?.uid && details?.dob) {
      await this.writeBackAadhaarAddress(leadId, details);
    }

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 4,
      request: result.requestJson,
      response: result.responseJson,
      status:
        details?.uid && details?.dob
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnRequestId: createLog.returnRequestId,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  /**
   * Ports the tail end of `payday_aadhaar_digilocker_api.php`'s e-Aadhaar
   * handler — writes the structured Aadhaar-address block back onto
   * `lead_customer`. Legacy resolves state/city by looking up the
   * Aadhaar-returned pincode against `master_pincode` (not a name-based
   * lookup), same here via `Pincode`. `LeadCustomer.aaCurrentEaadhaarAddress`
   * is the raw complete-address string (already mapped); this fills the
   * structured fields alongside it.
   */
  private async writeBackAadhaarAddress(
    leadId: number,
    details: {
      address?: string;
      splitAddress?: {
        city?: string[];
        addressLine?: string;
        landMark?: string;
        district?: string[];
        pincode?: string;
      };
    },
  ): Promise<void> {
    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!customer) return;

    const split = details.splitAddress;
    const pincodeValue = split?.pincode || '';
    const pincode = pincodeValue
      ? await this.pincodeRepository.findOne({
          where: { value: pincodeValue },
          relations: { city: { state: true } },
        })
      : null;

    customer.aaAddressLine1 = split?.addressLine || null;
    customer.aaAddressLine2 = split?.city?.[0] || null;
    customer.aaLandmark = split?.landMark || split?.district?.[0] || null;
    customer.aaCurrentEaadhaarAddress = details.address || null;
    customer.aaPincode = pincodeValue || null;
    customer.aaState = pincode?.city.state ?? null;
    customer.aaCity = pincode?.city ?? null;
    await this.leadCustomerRepository.save(customer);
  }

  /**
   * Digitap Digilocker create-URL — ports `digitap_digilocker_create_url_api_call`
   * (`payday_aadhaar_digilocker_api.php`), dispatcher method id 8. Confirmed
   * live via `ApiCallBackController::digitapView()`.
   */
  async createDigitapDigilockerUrl(leadId: number): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');

    const redirectUrl = this.buildDigitapRedirectUrl(leadId);
    const result = await this.digitap.postJson(DIGITAP_DIGILOCKER_CREATE_URL, {
      serviceId: '4',
      uid: String(leadId),
      firstName: '',
      lastName: '',
      mobile: '',
      emailId: '',
      isSendOtp: true,
      isHideExplanationScreen: false,
      redirectionUrl: redirectUrl,
    });
    const model = (
      result.data as { model?: { transactionId?: string; kycUrl?: string } }
    )?.model;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 1,
      provider: ApiProvider.DIGITAP,
      request: result.requestJson,
      response: result.responseJson,
      status:
        model?.transactionId && model?.kycUrl
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnUrl: model?.kycUrl ?? null,
      returnRequestId: model?.transactionId ?? null,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  /**
   * Digitap Digilocker get-details — ports `digitap_digilocker_get_details_api_call`,
   * dispatcher method id 9. Confirmed live via `ApiCallBackController::digitapResponse()`.
   */
  async getDigitapDigilockerDetails(leadId: number): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const createLog = await this.ekycLogRepository.findOne({
      where: {
        lead: { id: leadId },
        methodId: 1,
        provider: ApiProvider.DIGITAP,
      },
      order: { id: 'DESC' },
    });
    if (!createLog?.returnRequestId) {
      throw new BadRequestException(
        'No Digitap Digilocker create-URL request found for this lead — call createDigitapDigilockerUrl first',
      );
    }

    const result = await this.digitap.postJson(
      DIGITAP_DIGILOCKER_GET_DETAILS_URL,
      { transactionId: createLog.returnRequestId },
    );
    const model = (result.data as { model?: { status?: string } })?.model;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 2,
      provider: ApiProvider.DIGITAP,
      request: result.requestJson,
      response: result.responseJson,
      status:
        model?.status === 's' ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      returnRequestId: createLog.returnRequestId,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  /**
   * Digitap eKYC create-OTP — ports `digitap_ekyc_create_otp_api_call`
   * (dispatcher method id 6, `DIGITAP_EKYC_CREATE_OTP`). Confirmed live via
   * `ApiCallBackController.php:1352`.
   */
  async createDigitapEkycOtp(
    leadId: number,
    aadhaarNo: string,
  ): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');

    const uniqueId = `${leadId}${Date.now()}`;
    const result = await this.digitap.postJson(DIGITAP_EKYC_CREATE_OTP_URL, {
      uniqueId,
      uid: aadhaarNo,
    });
    const data = result.data as { code?: string; msg?: string } | null;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 6,
      provider: ApiProvider.DIGITAP,
      aadhaarNo,
      request: result.requestJson,
      response: result.responseJson,
      status:
        data?.code === '200' ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  /**
   * Digitap eKYC submit-OTP — ports `digitap_ekyc_create_otp_api_success`
   * (dispatcher method id 7, `DIGITAP_EKYC_SUCCESS`). Confirmed live via
   * `ApiCallBackController.php:1380`/`1446`. Re-reads the create-OTP log's
   * response for `transactionId`/`fwdp`/`codeVerifier`, same as legacy.
   */
  async submitDigitapEkycOtp(leadId: number, otp: string): Promise<EkycLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const createLog = await this.ekycLogRepository.findOne({
      where: {
        lead: { id: leadId },
        methodId: 6,
        provider: ApiProvider.DIGITAP,
      },
      order: { id: 'DESC' },
    });
    if (!createLog?.response) {
      throw new BadRequestException(
        'No Digitap eKYC create-OTP request found for this lead — call createDigitapEkycOtp first',
      );
    }

    const createModel = (
      JSON.parse(createLog.response) as {
        model?: {
          transactionId?: string;
          fwdp?: string;
          codeVerifier?: string;
        };
      }
    ).model;
    if (!createModel?.transactionId) {
      throw new BadRequestException(
        'Digitap eKYC create-OTP response is missing transactionId — cannot submit OTP',
      );
    }

    const result = await this.digitap.postJson(DIGITAP_EKYC_SUBMIT_OTP_URL, {
      transactionId: createModel.transactionId,
      fwdp: createModel.fwdp,
      codeVerifier: createModel.codeVerifier,
      otp,
      shareCode: '1234',
      isSendPdf: true,
    });
    const data = result.data as { code?: string } | null;

    const log = this.ekycLogRepository.create({
      lead,
      methodId: 7,
      provider: ApiProvider.DIGITAP,
      aadhaarNo: createLog.aadhaarNo,
      request: result.requestJson,
      response: result.responseJson,
      status:
        data?.code === '200' ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.ekycLogRepository.save(log);
  }

  private buildDigitapRedirectUrl(leadId: number): string {
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    return `${lmsUrl}/digitap-aadhaar-veri-response?refstr=${leadId}`;
  }

  private buildRedirectUrl(leadId: number): string {
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    return `${lmsUrl}/aadhaar-veri-response?refstr=${leadId}`;
  }
}
