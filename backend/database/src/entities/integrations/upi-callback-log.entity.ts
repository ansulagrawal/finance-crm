import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>QRCode, 2=>CollectPay — legacy `acu_method_id` comment. */
export enum UpiCallbackMethod {
  QRCODE = 1,
  COLLECT_PAY = 2,
}

/**
 * Legacy `api_callback_upi` — the ICICI UPI deposit callback
 * (`IciciCallbackController::deposit_callback()`). Legacy decrypts the raw
 * callback body with an RSA private key (PKCS1 padding) rather than
 * verifying an HMAC signature — decryption succeeding IS the trust boundary
 * in this design. Ported faithfully, not upgraded to a different scheme.
 */
@Entity('api_callback_upi')
export class UpiCallbackLog {
  @PrimaryGeneratedColumn({ name: 'acu_id', type: 'bigint' })
  id: number;

  @Column({ name: 'acu_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'acu_lead_id' })
  lead: Lead;

  @Column({ name: 'acu_method_id', type: 'tinyint' })
  method: UpiCallbackMethod;

  @Column({
    name: 'acu_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionId: string | null;

  @Column({ name: 'acu_response', type: 'text', nullable: true })
  decryptedResponse: string | null;

  @Column({ name: 'acu_encrypt_response', type: 'longtext', nullable: true })
  encryptedResponse: string | null;

  @Column({ name: 'acu_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'acu_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'acu_requested_amount', type: 'bigint', nullable: true })
  requestedAmount: number | null;

  @Column({ name: 'acu_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'acu_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'acu_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
