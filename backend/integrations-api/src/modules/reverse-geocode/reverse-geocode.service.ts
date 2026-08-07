import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, Lead, ReverseGeocodeLog } from '@finance-crm/database';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleMapsClientService } from '../google-maps/google-maps-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

/** Reverse geocoding — ports `payday_reverse_geo_code.php`
 * (`get_reverse_geo_code_api`), `POST v3/geocoding/reverse-geocode` — turns
 * a device lat/long fix into a human-readable address for the live-selfie
 * location check.
 *
 * Signzy is primary (matches legacy). Google Maps is a fallback when Signzy
 * fails — legacy configured a `GOOGLE_MAPS`/`REVERSE_GEO_CODE` integration
 * but never wired a caller to it (see `GoogleMapsClientService`'s doc
 * comment); this is new resilience, not a legacy behavior being ported.
 * Digitap has no coords-to-address function in legacy (only the reverse
 * direction, `ADDRESS_TO_LAT_LONG`), so it cannot serve as a fallback here.
 *
 * `ReverseGeocodeLog` (`api_reverse_geo_code`) has no column recording which
 * provider actually served a given result — legacy never needed one since
 * only Signzy was ever called. That's real-entity fidelity, not a
 * mapping gap, so this port doesn't invent one; the response/request
 * bodies already differ by provider if that needs reconstructing later.
 */
@Injectable()
export class ReverseGeocodeService {
  private readonly logger = new Logger(ReverseGeocodeService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(ReverseGeocodeLog)
    private readonly logRepository: Repository<ReverseGeocodeLog>,
    private readonly signzy: SignzyClientService,
    private readonly googleMaps: GoogleMapsClientService,
  ) {}

  async resolve(dto: ReverseGeocodeDto): Promise<ReverseGeocodeLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const result = await this.signzy.post(
      'v3/geocoding/reverse-geocode',
      { latitude: dto.latitude, longitude: dto.longitude },
      { 'x-client-unique-id': 'it@financecrm.com' },
    );
    const response = result.data as {
      latitude?: string;
      longitude?: string;
      address?: string;
    };
    const isSuccess = Boolean(response?.latitude && response?.longitude);

    let status = isSuccess ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR;
    let errors = result.errorMessage;
    let requestJson = result.requestJson;
    let responseJson = result.responseJson;

    if (!isSuccess) {
      try {
        const fallback = await this.googleMaps.reverseGeocode(
          dto.latitude,
          dto.longitude,
        );
        status = ApiCallStatus.SUCCESS;
        errors = null;
        requestJson = fallback.requestJson;
        responseJson = fallback.responseJson;
      } catch (error) {
        this.logger.warn(
          `Google Maps reverse-geocode fallback also failed for lead ${dto.leadId}: ${(error as Error).message}`,
        );
      }
    }

    const log = this.logRepository.create({
      lead,
      latitude: dto.latitude,
      longitude: dto.longitude,
      request: requestJson,
      response: responseJson,
      status,
      errors,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
