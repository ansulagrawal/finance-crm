import { findOrFail } from '@finance-crm/common';
import {
  AddressApiStatus,
  AddressDistanceLog,
  AddressLatLongLog,
  ApiCallStatus,
  Lead,
  LeadCustomer,
  ReverseGeocodeLog,
} from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleMapsClientService } from '../google-maps/google-maps-client.service';
import { CalculateAddressDistanceDto } from './dto/calculate-address-distance.dto';

const AADHAAR_ADDRESS_TYPE = 2;

/** `address_lat_long_api_logs.api_name`/`.method_id`/`.provider_id` for this
 * call — legacy's own `address_distance_api_google()` hardcodes
 * `api_name = "DIGITAP_API_ADDRESS_DISTANCE"` (a copy-paste artifact from a
 * sibling Digitap-based distance function in the same file, confirmed
 * directly in `payday_reverse_geo_code.php` — not this port's naming
 * choice) alongside `method_id = 4`, `provider_id = 3`. Kept identical so
 * any downstream query filtering by these values still matches. */
const API_NAME = 'DIGITAP_API_ADDRESS_DISTANCE';
const METHOD_ID = 4;
const PROVIDER_ID = 3;

/**
 * Ports `address_distance_api_google` (`payday_reverse_geo_code.php`) —
 * distance between the customer's Aadhaar/eKYC address and their live
 * (device GPS) location, used by `core-api`'s audit straight-through gate
 * (>25km requires a residence-proof document upload). Reads the two
 * coordinate pairs from logs already captured by other modules
 * (`AddressLatLongLog` addressType=2 for Aadhaar, `ReverseGeocodeLog` for
 * live location) rather than re-deriving address text, unlike legacy.
 */
@Injectable()
export class AddressDistanceService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(AddressLatLongLog)
    private readonly addressLatLongLogRepository: Repository<AddressLatLongLog>,
    @InjectRepository(ReverseGeocodeLog)
    private readonly reverseGeocodeLogRepository: Repository<ReverseGeocodeLog>,
    @InjectRepository(AddressDistanceLog)
    private readonly logRepository: Repository<AddressDistanceLog>,
    private readonly googleMaps: GoogleMapsClientService,
  ) {}

  async calculate(
    dto: CalculateAddressDistanceDto,
  ): Promise<AddressDistanceLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const aadhaarLatLong = await this.addressLatLongLogRepository.findOne({
      where: {
        lead: { id: dto.leadId },
        addressType: AADHAAR_ADDRESS_TYPE,
        status: AddressApiStatus.SUCCESS,
      },
      order: { id: 'DESC' },
    });
    if (!aadhaarLatLong?.latitude || !aadhaarLatLong?.longitude) {
      throw new BadRequestException(
        'Aadhaar address lat/long is not available for this lead yet — call POST /address-lat-long first',
      );
    }

    const liveLocation = await this.reverseGeocodeLogRepository.findOne({
      where: { lead: { id: dto.leadId }, status: ApiCallStatus.SUCCESS },
      order: { id: 'DESC' },
    });
    if (!liveLocation?.latitude || !liveLocation?.longitude) {
      throw new BadRequestException(
        'Current Location is not available for this lead yet.',
      );
    }

    let distanceKm: number | null = null;
    let requestJson: string | null = null;
    let responseJson: string | null = null;
    let status: AddressApiStatus;
    let errorMessage: string | null = null;
    try {
      const result = await this.googleMaps.distanceMatrix(
        aadhaarLatLong.latitude,
        aadhaarLatLong.longitude,
        liveLocation.latitude,
        liveLocation.longitude,
      );
      distanceKm = result.distanceKm;
      requestJson = result.requestJson;
      responseJson = result.responseJson;
      status = AddressApiStatus.SUCCESS;
    } catch (error) {
      status = AddressApiStatus.FAILURE;
      errorMessage = (error as Error).message;
    }

    const log = await this.logRepository.save(
      this.logRepository.create({
        lead,
        apiName: API_NAME,
        methodId: METHOD_ID,
        providerId: PROVIDER_ID,
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        message: distanceKm !== null ? String(distanceKm) : null,
        request: requestJson,
        response: responseJson,
        status,
        errorMessage,
        requestedAt: new Date(),
        respondedAt: new Date(),
      }),
    );

    if (status === AddressApiStatus.SUCCESS) {
      const customer = await this.leadCustomerRepository.findOne({
        where: { lead: { id: dto.leadId } },
      });
      if (customer) {
        customer.residenceDistanceKm =
          distanceKm !== null ? String(distanceKm) : null;
        await this.leadCustomerRepository.save(customer);
      }
    }

    return log;
  }
}
