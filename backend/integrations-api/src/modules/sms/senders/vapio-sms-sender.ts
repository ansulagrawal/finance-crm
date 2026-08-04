import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type {
  SendSmsParams,
  SendSmsResult,
  SmsSender,
} from './sms-sender.interface';

/**
 * Real, currently-active OTP SMS provider (`SMS_PROVIDER` unset or `vapio`),
 * ported verbatim from `components/includes/integration/payday_sms_sent_api.php`
 * (`routemobile_sms_sent_api_call()`, `sms_type_id == 1`) — the only SMS
 * type with a live, non-commented-out code path in legacy.
 */
export class VapioSmsSender implements SmsSender {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const apiUrl = this.configService.get<string>(
      'VAPIO_SMS_API_URL',
      'https://vapio.in/api.php?',
    );
    const username = this.configService.getOrThrow<string>('VAPIO_USERNAME');
    const apiKey = this.configService.getOrThrow<string>('VAPIO_API_KEY');
    const senderId = this.configService.getOrThrow<string>('VAPIO_SENDER_ID');
    const peId = this.configService.getOrThrow<string>('VAPIO_PE_ID');

    // Real Vapio request shape, ported verbatim: a form-urlencoded query
    // string posted as the body (legacy builds it by hand via string
    // concatenation and posts it as CURLOPT_POSTFIELDS — URLSearchParams
    // here is the parameterized equivalent, not raw concatenation).
    const searchParams = new URLSearchParams({
      username,
      apikey: apiKey,
      senderid: senderId,
      route: 'TRANS',
      mobile: params.mobile,
      text: params.message,
      TID: params.templateId,
      PEID: peId,
      format: 'json',
    });
    const requestBody = searchParams.toString();

    try {
      const response = await firstValueFrom(
        this.httpService.post(apiUrl, requestBody, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      const responseBody = JSON.stringify(response.data);
      const data = response.data as { status?: string };
      if (data?.status === 'OK') {
        return {
          success: true,
          responseBody,
          errorMessage: null,
          isNetworkError: false,
        };
      }
      return {
        success: false,
        responseBody,
        errorMessage: 'Vapio did not return status=OK',
        isNetworkError: false,
      };
    } catch (error) {
      const axiosError = error as {
        response?: { data: unknown };
        message?: string;
      };
      return {
        success: false,
        responseBody: axiosError.response
          ? JSON.stringify(axiosError.response.data)
          : '',
        errorMessage: axiosError.message ?? 'Vapio SMS API call failed',
        isNetworkError: true,
      };
    }
  }
}
