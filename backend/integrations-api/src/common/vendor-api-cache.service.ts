import {
  ApiCallStatus,
  Lead,
  VendorApiCache,
  VendorApiCacheProvider,
  VendorApiCacheType,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

/**
 * Ports legacy `customer_api_data` — a cross-lead cache of vendor API
 * responses keyed by PAN (`api_unique_id`; every cached call type —
 * PAN fetch, PAN-to-email, PAN-to-UAN — takes a PAN as its input), so the
 * same person applying via multiple leads doesn't trigger a redundant
 * vendor call for data that's static across applications (not KYC/bureau
 * checks that need to be fresh per application). Any vendor adapter can opt
 * in via `get`/`set`; nothing is cached automatically. Unlike the
 * pre-rewrite entity, `provider`/`apiType` are numeric enums here (matching
 * legacy's real `tinyint` columns), not free strings.
 */
@Injectable()
export class VendorApiCacheService {
  constructor(
    @InjectRepository(VendorApiCache)
    private readonly cacheRepository: Repository<VendorApiCache>,
  ) {}

  async get(
    pan: string,
    provider: VendorApiCacheProvider,
    apiType: VendorApiCacheType,
  ): Promise<VendorApiCache | null> {
    return this.cacheRepository.findOne({
      where: {
        uniqueId: pan.toUpperCase(),
        provider,
        apiType,
        isActive: true,
      },
      order: { id: 'DESC' },
    });
  }

  async set(
    pan: string,
    provider: VendorApiCacheProvider,
    apiType: VendorApiCacheType,
    response: string,
    lead: Lead | null = null,
    request: string | null = null,
  ): Promise<VendorApiCache> {
    const entry = this.cacheRepository.create({
      uniqueId: pan.toUpperCase(),
      provider,
      apiType,
      lead,
      request,
      response,
      status: ApiCallStatus.SUCCESS,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.cacheRepository.save(entry);
  }
}
