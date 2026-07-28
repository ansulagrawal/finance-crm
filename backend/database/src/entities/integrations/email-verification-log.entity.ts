import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>mailgun, 2=>signzy — legacy `ev_provider_id` comment. */
export enum EmailVerificationProvider {
  MAILGUN = 1,
  SIGNZY = 2,
}

/** 1=>Personal Email Validation, 2=>Office Email Validation — legacy `ev_method_id` comment. */
export enum EmailVerificationMethod {
  PERSONAL = 1,
  OFFICE = 2,
}

/** 1=>Yes, 2=>No — legacy `ev_email_validate_status` comment. */
export enum EmailVerificationResult {
  VALID = 1,
  INVALID = 2,
}

/** Legacy `api_email_verification_logs` (Signzy/Mailgun personal or office email validity check). */
@Entity('api_email_verification_logs')
export class EmailVerificationLog {
  @PrimaryGeneratedColumn({ name: 'ev_id', type: 'bigint' })
  id: number;

  @Column({ name: 'ev_lead_id', type: 'bigint' })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'ev_lead_id' })
  lead: Lead;

  @Column({ name: 'ev_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ev_user_id' })
  user: User | null;

  @Column({ name: 'ev_provider_id', type: 'tinyint', unsigned: true })
  provider: EmailVerificationProvider;

  @Column({ name: 'ev_method_id', type: 'tinyint', unsigned: true })
  method: EmailVerificationMethod;

  @Column({ name: 'ev_email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'ev_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'ev_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'ev_email_validate_status', type: 'tinyint', nullable: true })
  validationResult: EmailVerificationResult | null;

  @Column({ name: 'ev_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'ev_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'ev_request_datetime', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'ev_response_datetime', type: 'datetime' })
  respondedAt: Date;

  @Column({ name: 'ev_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'ev_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;

  /** Confirmed against a real prod schema export; absent from the UAT baseline. */
  @Column({
    name: 'ev_http_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  httpCode: string | null;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
  }
}
