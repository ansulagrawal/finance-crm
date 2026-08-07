import { findOrFail } from '@finance-crm/common';
import {
  AddressApiStatus,
  AddressLatLongLog,
  AddressType,
  Lead,
  LeadCustomer,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DigitapClientService } from '../digitap/digitap-client.service';
import type { GetAddressLatLongDto } from './dto/get-address-lat-long.dto';

const DIGITAP_ADDRESS_TO_LAT_LONG_URL =
  'https://api.digitap.ai/ent/v1/address-to-lat-long';

/** `address_lat_long_api_logs.api_name`, `.method_id`, `.provider_id` — legacy's
 * own `$type`/`$sub_type`/hardcoded ids for this specific call
 * (`payday_reverse_geo_code.php::address_to_lat_long_api_digitap()`), which
 * itself never sets `api_name` on insert (unlike its distance-endpoint
 * sibling, which does) — this follows the same `TYPE_SUBTYPE` naming
 * legacy's own `$type . '_' . $sub_type` would produce. */
const API_NAME = 'DIGITAP_API_ADDRESS_TO_LAT_LONG';
const METHOD_ID = 1;
const PROVIDER_ID = 2;

/**
 * Digitap address-to-lat-long — ports `address_to_lat_long_api_digitap`
 * (`payday_reverse_geo_code.php`), the opposite direction of the existing
 * Signzy-based `reverse-geocode` module (coords -> address). Digitap-only,
 * no Signzy equivalent exists in legacy for this direction. Confirmed live
 * via `VerificationController::calculateAadhaartoLiveLocationDistance`.
 *
 * Legacy composes the address server-side from `lead`/`lead_customer`
 * columns not modeled in this schema (`current_house`/`aa_current_house`
 * etc.) — this port takes the already-composed address as an input instead
 * of re-deriving it, matching how the OCR modules take a `documentUrl`
 * rather than resolving it from stored lead fields.
 *
 * On a successful `AADHAAR` (`address_type==2`) lookup, legacy also writes
 * the resolved coordinates onto `lead_customer.aa_aadhaar_address_coordinates`
 * (`"<lat>,<long>"`) — ported here too, not just the log row.
 */
@Injectable()
export class AddressLatLongService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(AddressLatLongLog)
    private readonly logRepository: Repository<AddressLatLongLog>,
    private readonly digitap: DigitapClientService,
  ) {}

  async getLatLong(dto: GetAddressLatLongDto): Promise<AddressLatLongLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const result = await this.digitap.postJson(
      DIGITAP_ADDRESS_TO_LAT_LONG_URL,
      {
        uniqueId: `${dto.leadId}${Date.now()}`,
        address: dto.address,
      },
    );
    const model = (
      result.data as {
        code?: number;
        model?: { latitude?: string; longitude?: string };
      }
    )?.model;
    const isSuccess = Boolean(model?.latitude && model?.longitude);

    const log = this.logRepository.create({
      lead,
      apiName: API_NAME,
      methodId: METHOD_ID,
      providerId: PROVIDER_ID,
      address: dto.address,
      addressType: dto.addressType,
      request: result.requestJson,
      response: result.responseJson,
      status: isSuccess ? AddressApiStatus.SUCCESS : AddressApiStatus.FAILURE,
      errorMessage: result.errorMessage,
      latitude: model?.latitude ?? null,
      longitude: model?.longitude ?? null,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    const savedLog = await this.logRepository.save(log);

    if (isSuccess && dto.addressType === AddressType.AADHAAR) {
      const leadCustomer = await this.leadCustomerRepository.findOne({
        where: { leadId: dto.leadId },
      });
      if (leadCustomer) {
        leadCustomer.aaAadhaarAddressCoordinates = `${model?.latitude},${model?.longitude}`;
        await this.leadCustomerRepository.save(leadCustomer);
      }
    }

    return savedLog;
  }
}
