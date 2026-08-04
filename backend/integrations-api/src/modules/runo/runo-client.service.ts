import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface RunoCallResult {
  data: unknown;
  requestJson: string;
  responseJson: string;
  errorMessage: string | null;
}

/**
 * Client for RUNO's call-allocation API — ports `runo_sanction_allocation_api`
 * (`payday_runo_call_api_helper.php`). No official RUNO Node SDK exists, so
 * this is a raw HTTP client, same approach as `SignzyClientService`/
 * `DigitapClientService`. Auth is a legacy-observed `Auth-Key: <token>`
 * header (distinct from Signzy/Digitap's bare `Authorization` convention).
 */
@Injectable()
export class RunoClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private apiKey(): string {
    return this.configService.getOrThrow<string>('RUNO_API_KEY');
  }

  async post(
    url: string,
    body: Record<string, unknown>,
  ): Promise<RunoCallResult> {
    const requestJson = JSON.stringify(body);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Auth-Key': this.apiKey(),
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
        errorMessage: axiosError.message ?? 'RUNO API call failed',
      };
    }
  }
}
