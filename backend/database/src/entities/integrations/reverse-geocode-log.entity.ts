import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/**
 * Legacy `api_reverse_geo_code` (Signzy reverse-geocode — turns a device
 * lat/long fix into a human-readable address for the live selfie-location
 * check). `rg_user_id` is a `varchar` in legacy, not numeric — no FK.
 */
@Entity('api_reverse_geo_code')
export class ReverseGeocodeLog {
  @PrimaryGeneratedColumn({ name: 'rg_log_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'rg_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'rg_lead_id' })
  lead: Lead;

  @Column({ name: 'rg_user_id', type: 'varchar', length: 20, nullable: true })
  userId: string | null;

  @Column({ name: 'rg_lan_no', type: 'varchar', length: 20, nullable: true })
  loanNumber: string | null;

  @Column({ name: 'rg_latitude', type: 'varchar', length: 500, nullable: true })
  latitude: string | null;

  @Column({
    name: 'rg_longitude',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  longitude: string | null;

  @Column({ name: 'rg_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'rg_response', type: 'longtext', nullable: true })
  response: string | null;

  @Column({ name: 'rg_api_status_id', type: 'mediumint', unsigned: true })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'rg_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'rg_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'rg_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'rg_active', type: 'tinyint', unsigned: true, default: 1 })
  isActive: boolean;

  @Column({ name: 'rg_deleted', type: 'tinyint', unsigned: true, default: 0 })
  isDeleted: boolean;
}
