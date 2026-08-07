import { Client, UnitSystem } from '@googlemaps/google-maps-services-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoogleReverseGeocodeResult {
  address: string;
  requestJson: string;
  responseJson: string;
}

export interface GoogleDistanceMatrixResult {
  distanceKm: number;
  requestJson: string;
  responseJson: string;
}

/**
 * Legacy configured a `GOOGLE_MAPS`/`REVERSE_GEO_CODE` integration
 * (`integration_config.php`, case `"GOOGLE_MAPS"`) but never wired a caller
 * to it — only Google's separate "address distance" feature
 * (`address_distance_api_google`) was ever actually invoked. This is a real
 * implementation of that dead config entry, used here as a Signzy fallback
 * (see `ReverseGeocodeService`) via Google's official Node SDK.
 */
@Injectable()
export class GoogleMapsClientService {
  constructor(private readonly configService: ConfigService) {}

  private client = new Client({});

  async reverseGeocode(
    latitude: string,
    longitude: string,
  ): Promise<GoogleReverseGeocodeResult> {
    const key = this.configService.getOrThrow<string>('GOOGLE_MAPS_APIKEY');
    const params = {
      latlng: `${latitude},${longitude}`,
      key,
    };

    const response = await this.client.reverseGeocode({ params });
    const firstResult = response.data.results[0];
    if (!firstResult) {
      throw new Error('No results from Google reverse-geocode API');
    }

    return {
      address: firstResult.formatted_address,
      requestJson: JSON.stringify({ latitude, longitude }),
      responseJson: JSON.stringify(response.data),
    };
  }

  /**
   * Ports `address_distance_api_google` (`payday_reverse_geo_code.php`),
   * confirmed live via `VerificationController::calculateAadhaartoLiveLocationDistance`.
   * Legacy sent address text as `origins`/`destinations` (Google's Distance
   * Matrix API accepts either) even though it separately parsed lat/long
   * out of stored coordinates first and then never used them — this port
   * uses coordinates directly since both call sites already have them
   * (`AddressLatLongLog`/`ReverseGeocodeLog`), which is strictly more
   * accurate than re-geocoding free-text address strings.
   */
  async distanceMatrix(
    originLat: string,
    originLong: string,
    destinationLat: string,
    destinationLong: string,
  ): Promise<GoogleDistanceMatrixResult> {
    const key = this.configService.getOrThrow<string>('GOOGLE_MAPS_APIKEY');
    const params = {
      origins: [`${originLat},${originLong}`],
      destinations: [`${destinationLat},${destinationLong}`],
      units: UnitSystem.metric,
      key,
    };

    const response = await this.client.distancematrix({ params });
    const element = response.data.rows[0]?.elements[0];
    if (response.data.status !== 'OK' || !element || element.status !== 'OK') {
      throw new Error('No distance returned from Google Distance Matrix API');
    }

    return {
      distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
      requestJson: JSON.stringify(params),
      responseJson: JSON.stringify(response.data),
    };
  }
}
