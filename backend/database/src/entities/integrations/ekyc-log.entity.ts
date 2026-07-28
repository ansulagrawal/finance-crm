import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';
import { ApiProvider } from './api-provider';

/**
 * Legacy `api_ekyc_logs` — Digilocker eKYC (create URL / get details / get
 * e-aadhaar / get files), one row per step, distinguished by `methodId`.
 *
 * Legacy has no created/updated timestamps here; `ekyc_request_datetime` is the
 * effective creation time.
 */
@Entity('api_ekyc_logs')
export class EkycLog {
  @PrimaryGeneratedColumn({ name: 'ekyc_id', type: 'bigint' })
  id: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'ekyc_lead_id' })
  lead: Lead;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ekyc_user_id' })
  user: User | null;

  @Column({ name: 'ekyc_method_id', type: 'tinyint' })
  methodId: number;

  @Column({
    name: 'ekyc_provider',
    type: 'tinyint',
    unsigned: true,
    default: ApiProvider.SIGNZY,
  })
  provider: ApiProvider;

  @Column({
    name: 'ekyc_aadhaar_no',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  aadhaarNo: string | null;

  @Column({ name: 'ekyc_request', type: 'longtext', nullable: true })
  request: string | null;

  @Column({ name: 'ekyc_response', type: 'longtext', nullable: true })
  response: string | null;

  @Column({
    name: 'ekyc_api_status_id',
    type: 'mediumint',
    default: ApiCallStatus.PENDING,
  })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'ekyc_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({ name: 'ekyc_return_url', type: 'text', nullable: true })
  returnUrl: string | null;

  @Column({
    name: 'ekyc_return_request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  returnRequestId: string | null;

  @Column({ name: 'ekyc_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'ekyc_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  /** Legacy `s3_flag`, NOT NULL — whether request/response bodies were offloaded
   * to S3 rather than stored inline. */
  @Column({
    name: 's3_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  storedInS3: boolean;

  @Column({
    name: 'ekyc_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'ekyc_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
