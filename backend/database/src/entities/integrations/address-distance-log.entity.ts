import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { AddressApiStatus } from './address-lat-long-log.entity';

/**
 * SPLIT per docs/SCHEMA-MAP.md: this maps the SAME legacy table as
 * `AddressLatLongLog` (`address_lat_long_api_logs`), not a separate one —
 * distance rows are distinguished by `apiName` (e.g.
 * `DIGITAP_API_ADDRESS_DISTANCE`), used for the Google Distance Matrix-style
 * check between the Aadhaar/eKYC address and the customer's live (device
 * GPS) location — the audit straight-through gate's >25km residence-proof
 * check. `latitude`/`longitude` here hold the destination fix; the computed
 * distance itself is stored in `message` (confirmed against
 * `address_distance_api_google()` in `payday_reverse_geo_code.php`, which
 * writes the rounded km value into that generic column — the same column
 * `AddressLatLongLog` maps on this shared table).
 */
@Entity('address_lat_long_api_logs')
export class AddressDistanceLog {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'int' })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'api_name', type: 'varchar', length: 100 })
  apiName: string;

  @Column({ name: 'method_id', type: 'mediumint', nullable: true })
  methodId: number | null;

  @Column({ name: 'provider_id', type: 'tinyint', nullable: true })
  providerId: number | null;

  @Column({ name: 'latitude', type: 'varchar', length: 50, nullable: true })
  latitude: string | null;

  @Column({ name: 'longitude', type: 'varchar', length: 50, nullable: true })
  longitude: string | null;

  @Column({ name: 'request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'response', type: 'text', nullable: true })
  response: string | null;

  /** The computed distance in km, stored as a string (legacy writes the
   * rounded value here with no unit suffix). */
  @Column({ name: 'message', type: 'varchar', length: 255, nullable: true })
  message: string | null;

  @Column({ name: 'api_status_id', type: 'tinyint' })
  status: AddressApiStatus;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  errorMessage: string | null;

  @Column({ name: 'request_time', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'response_time', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({
    name: 'active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
