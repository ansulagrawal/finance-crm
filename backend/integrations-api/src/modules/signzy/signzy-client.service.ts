import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface SignzyCallResult {
  statusCode: number | null;
  data: unknown;
  requestJson: string;
  responseJson: string;
  errorMessage: string | null;
}

/**
 * Shared client for every Signzy-backed adapter (eKYC/Digilocker, eSign,
 * bank account verification, face match, PAN/Aadhaar OCR + PAN fetch,
 * UAN verification, domain/email verification, video KYC, reverse geocode).
 * Legacy (`integration_config.php`, case "SIGNZY_API") picks a preprod vs
 * prod base URL and reads the token from a `SIGNZY_TOKEN` PHP constant —
 * this mirrors that with `SIGNZY_BASE_URL`/`SIGNZY_TOKEN` env vars instead.
 * All Signzy endpoints observed in the legacy code use a bare `Authorization: <token>`
 * header (no "Bearer " prefix) — kept identical here.
 */
@Injectable()
export class SignzyClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private baseUrl(): string {
    return this.configService.get<string>(
      'SIGNZY_BASE_URL',
      'https://api-preproduction.signzy.app/api/',
    );
  }

  private token(): string {
    return this.configService.getOrThrow<string>('SIGNZY_TOKEN');
  }

  async post(
    path: string,
    body: Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<SignzyCallResult> {
    const requestJson = JSON.stringify(body);
    const url = path.startsWith('http') ? path : `${this.baseUrl()}${path}`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.token(),
            ...extraHeaders,
          },
        }),
      );
      return {
        statusCode: response.status,
        data: response.data,
        requestJson,
        responseJson: JSON.stringify(response.data),
        errorMessage: null,
      };
    } catch (error) {
      return this.toErrorResult(error, requestJson);
    }
  }

  async get(
    path: string,
    params: Record<string, string> = {},
  ): Promise<SignzyCallResult> {
    const url = path.startsWith('http') ? path : `${this.baseUrl()}${path}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
          headers: { Authorization: this.token() },
        }),
      );
      return {
        statusCode: response.status,
        data: response.data,
        requestJson: JSON.stringify(params),
        responseJson: JSON.stringify(response.data),
        errorMessage: null,
      };
    } catch (error) {
      return this.toErrorResult(error, JSON.stringify(params));
    }
  }

  private toErrorResult(error: unknown, requestJson: string): SignzyCallResult {
    const axiosError = error as {
      response?: { status: number; data: unknown };
      message?: string;
    };
    return {
      statusCode: axiosError.response?.status ?? null,
      data: axiosError.response?.data ?? null,
      requestJson,
      responseJson: axiosError.response
        ? JSON.stringify(axiosError.response.data)
        : '',
      errorMessage: axiosError.message ?? 'Signzy API call failed',
    };
  }
}
