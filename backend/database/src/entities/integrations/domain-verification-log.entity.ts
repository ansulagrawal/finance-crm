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

/** Legacy `api_domain_verification_logs` (Signzy `domainVerificationLite` —
 * verifies the domain behind an office/alternate email address). */
@Entity('api_domain_verification_logs')
export class DomainVerificationLog {
  @PrimaryGeneratedColumn({ name: 'dv_id', type: 'bigint' })
  id: number;

  @Column({ name: 'dv_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'dv_lead_id' })
  lead: Lead;

  @Column({ name: 'dv_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dv_user_id' })
  user: User | null;

  /** 1=>Signzy — legacy comment implies room for more providers. */
  @Column({ name: 'dv_provider', type: 'tinyint', unsigned: true })
  provider: number;

  /** 1=>Get Domain Details — legacy `dv_method_id` comment. */
  @Column({ name: 'dv_method_id', type: 'tinyint' })
  method: number;

  @Column({ name: 'dv_email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'dv_domain', type: 'varchar', length: 255, nullable: true })
  domain: string | null;

  @Column({
    name: 'dv_registration_date',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  registrationDate: string | null;

  @Column({ name: 'dv_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'dv_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'dv_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'dv_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'dv_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'dv_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'dv_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'dv_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
  }
}
