import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface DigitapCallResult {
  data: unknown;
  requestJson: string;
  responseJson: string;
  errorMessage: string | null;
}

/**
 * Shared client for Digitap-backed adapters — an alternate provider to
 * Signzy for the same eKYC/OCR/verification functions, dispatcher-selected
 * by name in legacy (`payday_poi_ocr_api.php`'s `payday_poi_ocr_api_call`,
 * etc.), same as Signzy. No official Digitap Node SDK exists, so this is a
 * raw HTTP client, matching `SignzyClientService`'s own approach.
 *
 * Digitap's OCR endpoints (`ocr/v1/pan`, `ocr/v1/aadhaar`) take
 * `multipart/form-data` with the document image itself (`imageUrl` as a
 * file part, ported from legacy's `CURLFile`), not a JSON `documentUrl`
 * like Signzy — this client downloads the document bytes server-side
 * before uploading, since the DTO only carries a URL.
 *
 * Auth header is a bare `Authorization: <token>` (no "Bearer"/"Basic"
 * prefix), same convention as Signzy.
 */
@Injectable()
export class DigitapClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private token(): string {
    return this.configService.getOrThrow<string>('DIGITAP_API_TOKEN');
  }

  async postMultipart(
    url: string,
    fileUrl: string,
    fields: Record<string, string>,
  ): Promise<DigitapCallResult> {
    const requestJson = JSON.stringify({ imageUrl: fileUrl, ...fields });

    try {
      const fileResponse = await firstValueFrom(
        this.httpService.get(fileUrl, { responseType: 'arraybuffer' }),
      );
      const fileBlob = new Blob([fileResponse.data as ArrayBuffer]);

      const formData = new FormData();
      formData.append('imageUrl', fileBlob, 'document');
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }

      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: { Authorization: this.token() },
        }),
      );
      return {
        data: response.data,
        requestJson,
        responseJson: JSON.stringify(response.data),
        errorMessage: null,
      };
    } catch (error) {
      const axiosError = error as {
        response?: { data: unknown };
        message?: string;
      };
      return {
        data: null,
        requestJson,
        responseJson: axiosError.response
          ? JSON.stringify(axiosError.response.data)
          : '',
        errorMessage: axiosError.message ?? 'Digitap API call failed',
      };
    }
  }

  async postJson(
    url: string,
    body: Record<string, unknown>,
  ): Promise<DigitapCallResult> {
    const requestJson = JSON.stringify(body);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            Authorization: this.token(),
            'Content-Type': 'application/json',
          },
        }),
      );
      return {
        data: response.data,
        requestJson,
        responseJson: JSON.stringify(response.data),
        errorMessage: null,
      };
    } catch (error) {
      const axiosError = error as {
        response?: { data: unknown };
        message?: string;
      };
      return {
        data: null,
        requestJson,
        responseJson: axiosError.response
          ? JSON.stringify(axiosError.response.data)
          : '',
        errorMessage: axiosError.message ?? 'Digitap API call failed',
      };
    }
  }
}
