import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { CustomerBanking } from '../verification/customer-banking.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/**
 * 1=>Surepass, 2=>Digitap, 3=>Signzy — real prod `bav_provider_id` column
 * comment, confirmed against live prod log rows (2026-08-04): every real
 * provider-3 row's response carries Signzy's own field names
 * (`signzyReferenceId`, `bankTransfer`, `auditTrail.nature: "BANK RRN"`),
 * matching legacy `payday_bank_verification_api_helper.php`'s
 * `signzy_bank_account_verification_api()`. Surepass is wired as an
 * automatic failover for bank-account verification when Signzy is down
 * (client-confirmed), replacing whatever NUPAY meant historically at slot
 * 1. Some real rows carry provider 44, outside this 1-3 range and still
 * bearing Signzy field names — unresolved, see `docs/TODO.md`.
 */
export enum BankVerificationProvider {
  SUREPASS = 1,
  DIGITAP = 2,
  SIGNZY = 3,
}

/** 1=>token api, 2=>penny drop — legacy `bav_method_id` comment. */
export enum BankVerificationMethod {
  TOKEN_API = 1,
  PENNY_DROP = 2,
}

/** Legacy `api_bank_account_verification_logs` (Signzy/Digitap penny-drop bank account verification). */
@Entity('api_bank_account_verification_logs')
export class BankVerificationLog {
  @PrimaryGeneratedColumn({ name: 'bav_id', type: 'bigint' })
  id: number;

  @Column({ name: 'bav_lead_id', type: 'bigint' })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'bav_lead_id' })
  lead: Lead;

  @Column({
    name: 'bav_cust_banking_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  customerBankingId: number | null;

  @ManyToOne(() => CustomerBanking, { nullable: true })
  @JoinColumn({ name: 'bav_cust_banking_id' })
  customerBanking: CustomerBanking | null;

  @Column({ name: 'bav_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'bav_user_id' })
  user: User | null;

  @Column({ name: 'bav_provider_id', type: 'tinyint', unsigned: true })
  provider: BankVerificationProvider;

  @Column({ name: 'bav_method_id', type: 'tinyint', unsigned: true })
  method: BankVerificationMethod;

  @Column({ name: 'bav_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'bav_response', type: 'text', nullable: true })
  response: string | null;

  @Column({
    name: 'bav_auth_token',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  authToken: string | null;

  @Column({ name: 'bav_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'bav_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'bav_request_datetime', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'bav_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'bav_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'bav_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;

  /** Confirmed against a real prod schema export; absent from the UAT baseline. */
  @Column({
    name: 'bav_http_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  httpCode: string | null;
}
