import { BeforeInsert, BeforeUpdate, Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** Mirrors legacy `api_email_verification_logs` (pluggable email-validation
 * API — distinct from the Signzy-based `domain-email-verification` module.
 * Only SendGrid is implemented for now (`EMAIL_VALIDATOR` token), matching
 * legacy's own `EMAIL_VALIDATION`/`SENDGRID_EMAIL_VALIDATE` dispatch. */
@Entity('email_validation_logs')
export class EmailValidationLog extends BaseEntity {
  @ManyToOne(() => Lead, { nullable: true })
  lead: Lead | null;

  @ManyToOne(() => User, { nullable: true })
  user: User | null;

  /** 1 = personal email, 2 = alternate email (legacy's `ev_method_id`). */
  @Column({ type: 'tinyint' })
  emailType: number;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 20, default: 'sendgrid' })
  provider: string;

  @Column({ type: 'tinyint', default: 0, transformer: tinyintBoolean })
  isValid: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  verdict: string | null;

  @Column({ type: 'text', nullable: true })
  request: string | null;

  @Column({ type: 'text', nullable: true })
  response: string | null;

  @Column({ type: 'enum', enum: ApiCallStatus, default: ApiCallStatus.PENDING })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  respondedAt: Date | null;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email.toLowerCase();
  }
}
