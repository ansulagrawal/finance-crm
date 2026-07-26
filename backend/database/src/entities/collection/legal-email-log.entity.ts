import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';

/**
 * Legacy `legal_email_logs` (confirmed against a real UAT export) — dedup
 * record for `CronLegalEmailerController::legalNoticeEmailer()`. Legacy's
 * `legal_email_type_id` only documents a single generic "1=>Legal Email"
 * value, not a per-notice-type split (`'dn'`/`'fn'`/`'lrn'`), so `typeId` is
 * kept as the raw legacy code rather than an invented enum.
 */
@Entity('legal_email_logs')
export class LegalEmailLog {
  @PrimaryGeneratedColumn({
    name: 'legal_email_log_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({
    name: 'legal_email_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'legal_email_lead_id' })
  lead: Lead | null;

  @Column({
    name: 'legal_email_loan_no',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  loanNumber: string | null;

  @Column({
    name: 'legal_email_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  provider: string | null;

  @Column({ name: 'legal_email_type_id', type: 'mediumint', unsigned: true })
  typeId: number;

  @Column({ name: 'legal_email_sent_to', type: 'varchar', length: 150 })
  sentTo: string;

  @Column({
    name: 'legal_email_sent_cc',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  sentCc: string | null;

  @Column({ name: 'legal_email_sent_bcc', type: 'varchar', length: 150 })
  sentBcc: string;

  @Column({ name: 'legal_email_content', type: 'text', nullable: true })
  content: string | null;

  @Column({
    name: 'legal_email_api_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  apiStatusId: number | null;

  @Column({
    name: 'legal_email_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({ name: 'legal_notice_send_by', type: 'int', nullable: true })
  sentById: number | null;

  @Column({ name: 'legal_email_created_on', type: 'datetime' })
  sentAt: Date;

  @Column({
    name: 'legal_email_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'legal_email_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
