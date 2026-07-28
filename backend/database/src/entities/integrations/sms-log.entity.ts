import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/**
 * Legacy `api_sms_logs` (confirmed against a real UAT restore — 122 real
 * rows). Real, currently-active vendor is **Vapio**
 * (`components/includes/integration/payday_sms_sent_api.php` —
 * despite the function name `routemobile_sms_sent_api_call()`, the live
 * code path posts to Vapio's real API). Only `smsTypeId = 1` (OTP) is live.
 *
 * **A live Vapio username/API key/PE_ID were found hardcoded directly in
 * this legacy PHP file** — never copied anywhere in this port; see
 * docs/TODO.md.
 */
@Entity('api_sms_logs')
export class SmsLog {
  @PrimaryGeneratedColumn({
    name: 'sms_log_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({
    name: 'sms_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'sms_lead_id' })
  lead: Lead | null;

  @Column({ name: 'sms_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sms_user_id' })
  user: User | null;

  @Column({
    name: 'sms_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'Vapio',
  })
  provider: string | null;

  @Column({ name: 'sms_type_id', type: 'mediumint', unsigned: true })
  typeId: number;

  @Column({ name: 'sms_mobile', type: 'varchar', length: 250 })
  mobile: string;

  @Column({ name: 'sms_content', type: 'text', nullable: true })
  content: string | null;

  @Column({
    name: 'sms_template_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  templateId: string | null;

  @Column({
    name: 'sms_template_source',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  templateSource: string | null;

  @Column({
    name: 'sms_api_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  @SerializeApiCallStatus()
  apiStatus: ApiCallStatus | null;

  @Column({
    name: 'sms_api_response',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  apiResponse: string | null;

  @Column({ name: 'sms_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({
    name: 'sms_provider_used',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerUsed: string | null;

  @Column({
    name: 'sms_attempted_providers',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  attemptedProviders: string | null;

  @Column({ name: 'sms_created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'sms_active', type: 'tinyint', unsigned: true, default: 1 })
  isActive: boolean;

  @Column({ name: 'sms_deleted', type: 'tinyint', unsigned: true, default: 0 })
  isDeleted: boolean;
}
