import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_TIMESTAMP_HEADER,
  signInternalRequest,
} from '../auth/internal-service-auth.util';

/**
 * Thin, signed wrapper around `integrations-api`'s vendor endpoints
 * (SMS/email/WhatsApp/RUNO/etc). Used by both `automation-worker` (cron
 * jobs calling vendors) and `core-api` (workflow actions that must fire a
 * vendor call synchronously, e.g. `LeadsService.selfAllocate()` triggering
 * RUNO) — previously two verbatim-duplicate client classes, one carrying a
 * stale comment claiming `integrations-api` had no auth guard (it does:
 * a global `JwtAuthGuard`, cookie-based, which a server-to-server axios
 * call never carries). Consolidated here and signed via
 * `internal-service-auth.util.ts` so `JwtAuthGuard`'s internal-request path
 * actually authenticates these calls instead of them silently 401ing.
 *
 * Base URL is env-var-driven (`INTEGRATIONS_API_URL`), never hardcoded, so
 * this works unchanged under docker-compose or behind the production
 * internal ALB.
 */

/**
 * `integrations-api` mounts every route under this prefix
 * (`setGlobalPrefix('api/v1/integrations')` in its `main.ts`), so a caller
 * must include it or every request 404s.
 *
 * It belongs here rather than in `INTEGRATIONS_API_URL` because it is a
 * property of the service's own routing, not of where the service is
 * deployed — and getting that wrong is silent: `NotificationsService` and
 * every automation-worker email/SMS job catch and log their failure, so a
 * 404 here looks like "no mail arrived", never like a misconfiguration.
 */
const INTEGRATIONS_API_PREFIX = '/api/v1/integrations';
@Injectable()
export class IntegrationsApiClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>(
      'INTEGRATIONS_API_URL',
      'http://localhost:3001',
    );
    this.secret = config.getOrThrow<string>('INTERNAL_SERVICE_SECRET');
  }

  /**
   * Joins base + prefix + path, tolerating a base that already carries the
   * prefix — a path-routed ALB target may legitimately be configured that
   * way, and doubling it up would 404 just as silently.
   */
  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const root = base.endsWith(INTEGRATIONS_API_PREFIX)
      ? base
      : `${base}${INTEGRATIONS_API_PREFIX}`;
    return `${root}${path}`;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const bodyString = JSON.stringify(body ?? {});
    const { signature, timestamp } = signInternalRequest(
      'POST',
      new URL(url).pathname,
      Buffer.from(bodyString, 'utf-8'),
      this.secret,
    );
    const response = await firstValueFrom(
      this.http.post<T>(url, bodyString, {
        headers: {
          'content-type': 'application/json',
          [INTERNAL_SIGNATURE_HEADER]: signature,
          [INTERNAL_TIMESTAMP_HEADER]: timestamp,
        },
      }),
    );
    return response.data;
  }

  async get<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    const { signature, timestamp } = signInternalRequest(
      'GET',
      new URL(url).pathname,
      Buffer.alloc(0),
      this.secret,
    );
    const response = await firstValueFrom(
      this.http.get<T>(url, {
        headers: {
          [INTERNAL_SIGNATURE_HEADER]: signature,
          [INTERNAL_TIMESTAMP_HEADER]: timestamp,
        },
      }),
    );
    return response.data;
  }
}
