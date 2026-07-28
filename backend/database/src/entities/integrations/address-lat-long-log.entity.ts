import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';

/** 1 = Success, 0 = Failure — legacy `address_lat_long_api_logs.api_status_id` comment (own binary convention, not the shared ApiCallStatus). */
export enum AddressApiStatus {
  FAILURE = 0,
  SUCCESS = 1,
}

/** 1=>current, 2=>aadhaar — legacy `address_type` comment. */
export enum AddressType {
  CURRENT = 1,
  AADHAAR = 2,
}

/**
 * Legacy `address_lat_long_api_logs` (Digitap `ent/v1/address-to-lat-long` —
 * turns a free-text address into lat/long, the opposite direction of
 * `ReverseGeocodeLog`). SPLIT per docs/SCHEMA-MAP.md: this same table also
 * backs `AddressDistanceLog`, discriminated by `apiName`/`methodId` (distance
 * rows use a distance-specific `api_name` value, e.g.
 * `DIGITAP_API_ADDRESS_DISTANCE`) — not two physical tables.
 */
@Entity('address_lat_long_api_logs')
export class AddressLatLongLog {
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

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'address_type', type: 'tinyint', nullable: true })
  addressType: AddressType | null;

  @Column({ name: 'latitude', type: 'varchar', length: 50, nullable: true })
  latitude: string | null;

  @Column({ name: 'longitude', type: 'varchar', length: 50, nullable: true })
  longitude: string | null;

  @Column({ name: 'request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'api_status_id', type: 'tinyint' })
  status: AddressApiStatus;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  errorMessage: string | null;

  @Column({ name: 'message', type: 'varchar', length: 255, nullable: true })
  message: string | null;

  @Column({ name: 'http_status_code', type: 'smallint', nullable: true })
  httpStatusCode: number | null;

  @Column({ name: 'user_id', type: 'bigint', nullable: true, default: 0 })
  userId: number | null;

  @Column({ name: 'duration', type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ name: 'request_time', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'response_time', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date | null;

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
