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

/** 1=>Get QRCode, 2=>CollectPay, 3=>Check Transaction Status — legacy `au_method_id` comment. */
export enum UpiCollectionMethod {
  QRCODE_REQUEST = 1,
  COLLECT_PAY_REQUEST = 2,
  CHECK_STATUS = 3,
}

/**
 * Legacy `api_upi_logs` (ICICI Bank EazyPay UPI QR/collect-pay API,
 * confirmed in `old-php-files/components/includes/integration/call_upi_api.php`).
 * Not a generic UPI gateway.
 */
@Entity('api_upi_logs')
export class UpiCollectionLog {
  @PrimaryGeneratedColumn({ name: 'au_id', type: 'bigint' })
  id: number;

  @Column({ name: 'au_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'au_lead_id' })
  lead: Lead;

  @Column({ name: 'au_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'au_user_id' })
  user: User | null;

  /** 1=>ICICI — legacy comment implies room for more providers. */
  @Column({ name: 'au_provider', type: 'tinyint', unsigned: true })
  provider: number;

  @Column({ name: 'au_method_id', type: 'tinyint' })
  method: UpiCollectionMethod;

  @Column({
    name: 'au_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionId: string | null;

  @Column({ name: 'au_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'au_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'au_encrypt_request', type: 'longtext', nullable: true })
  encryptedRequest: string | null;

  @Column({ name: 'au_encrypt_response', type: 'longtext', nullable: true })
  encryptedResponse: string | null;

  @Column({ name: 'au_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'au_status_check',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  statusCheckAttempts: number | null;

  @Column({ name: 'au_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({
    name: 'au_requested_amount',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestedAmount: string | null;

  @Column({ name: 'au_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'au_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'au_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'au_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
