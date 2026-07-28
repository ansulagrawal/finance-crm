import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Encrypt, 2=>Decrypt — legacy `middleware_method_id` comment. */
export enum MiddlewareApiMethod {
  ENCRYPT = 1,
  DECRYPT = 2,
}

/**
 * Legacy `api_java_middleware_logs` — a generic internal Java middleware
 * integration log, keyed by product/method/api-name rather than a specific
 * vendor. One of the four legacy tables with no primary key (needs ADD
 * PRIMARY KEY on `middleware_log_id` per docs/SCHEMA-MAP.md).
 */
@Entity('api_java_middleware_logs')
export class MiddlewareApiLog {
  @PrimaryColumn({ name: 'middleware_log_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'middleware_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'middleware_lead_id' })
  lead: Lead | null;

  @Column({ name: 'middleware_product_id', type: 'smallint', unsigned: true })
  productId: number;

  @Column({ name: 'middleware_method_id', type: 'smallint', unsigned: true })
  method: MiddlewareApiMethod;

  @Column({ name: 'middleware_api_name', type: 'varchar', length: 100 })
  apiName: string;

  @Column({ name: 'middleware_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'middleware_response', type: 'text', nullable: true })
  response: string | null;

  @Column({
    name: 'middleware_api_status_id',
    type: 'mediumint',
    unsigned: true,
  })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'middleware_errors', type: 'text', nullable: true })
  errors: string | null;

  @Column({
    name: 'middleware_request_datetime',
    type: 'datetime',
    nullable: true,
  })
  requestedAt: Date | null;

  @Column({
    name: 'middleware_response_datetime',
    type: 'datetime',
    nullable: true,
  })
  respondedAt: Date | null;

  @Column({
    name: 'middleware_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
  })
  isActive: boolean;

  @Column({
    name: 'middleware_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  isDeleted: boolean;
}
