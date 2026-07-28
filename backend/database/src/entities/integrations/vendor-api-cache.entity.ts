import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Signzy, 2=>DigiTap, 3=>Surepass — legacy `api_provider` comment. */
export enum VendorApiCacheProvider {
  SIGNZY = 1,
  DIGITAP = 2,
  SUREPASS = 3,
}

/** 1=>PAN FETCH, 2=>PAN TO EMAIL, 3=>PAN TO UAN — legacy `api_type` comment. */
export enum VendorApiCacheType {
  PAN_FETCH = 1,
  PAN_TO_EMAIL = 2,
  PAN_TO_UAN = 3,
}

/** 0=>Web, 1=>CRM — legacy `api_source` comment. */
export enum VendorApiCacheSource {
  WEB = 0,
  CRM = 1,
}

/**
 * Legacy `customer_api_data` — a cross-lead cache of vendor API responses,
 * keyed by `api_unique_id` (the identifier — e.g. PAN — the call was made
 * for), so the same person applying via multiple leads doesn't trigger a
 * redundant vendor call for data that doesn't change between applications.
 * Legacy has no expiry column, so neither does this.
 */
@Entity('customer_api_data')
export class VendorApiCache {
  @PrimaryGeneratedColumn({ name: 'api_id', type: 'bigint' })
  id: number;

  @Column({
    name: 'api_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  /** The lead that first populated this cache entry — informational only, not part of the lookup key. */
  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'api_lead_id' })
  lead: Lead | null;

  @Column({ name: 'api_provider', type: 'tinyint', unsigned: true })
  provider: VendorApiCacheProvider;

  @Column({ name: 'api_type', type: 'tinyint' })
  apiType: VendorApiCacheType;

  @Column({
    name: 'api_unique_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  uniqueId: string | null;

  @Column({
    name: 'api_profile_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  profileId: number | null;

  @Column({ name: 'api_url', type: 'varchar', length: 500, nullable: true })
  url: string | null;

  @Column({ name: 'api_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'api_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'api_custom_response', type: 'text', nullable: true })
  customResponse: string | null;

  @Column({ name: 'api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'api_source',
    type: 'tinyint',
    default: VendorApiCacheSource.CRM,
  })
  source: VendorApiCacheSource;

  @Column({ name: 'api_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'api_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({
    name: 'api_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'api_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
