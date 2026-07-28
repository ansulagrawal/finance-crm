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
import { ApiCallStatus } from './api-call-status';

/**
 * Legacy `api_email_logs`. Real mechanism: plain **SMTP** via CodeIgniter's
 * built-in email library, relayed through **Mailgun's SMTP endpoint**
 * (`smtp.mailgun.org:587`) — not a vendor HTTP API like every other
 * integration in this codebase. There is no `master_email_template`
 * -equivalent table in the legacy schema — email content is built ad-hoc as
 * inline HTML strings in PHP, not templated in the database.
 *
 * **A live Mailgun SMTP password was found hardcoded directly in the legacy
 * PHP file** — never copied anywhere in this port; see docs/TODO.md.
 */
@Entity('api_email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn({
    name: 'email_log_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({
    name: 'email_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'email_lead_id' })
  lead: Lead | null;

  @Column({
    name: 'email_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'SMTP (Mailgun)',
  })
  provider: string | null;

  @Column({ name: 'email_type_id', type: 'mediumint', unsigned: true })
  typeId: number;

  @Column({ name: 'email_address', type: 'varchar', length: 150 })
  emailAddress: string;

  @Column({ name: 'email_content', type: 'text', nullable: true })
  content: string | null;

  @Column({
    name: 'email_api_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  apiStatus: ApiCallStatus | null;

  @Column({
    name: 'email_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({ name: 'email_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'email_active', type: 'tinyint', unsigned: true, default: 1 })
  isActive: boolean;

  @Column({
    name: 'email_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  isDeleted: boolean;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.emailAddress = this.emailAddress?.toLowerCase() ?? this.emailAddress;
  }
}
