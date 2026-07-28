import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DisbursementBank } from '../disbursal/disbursement-bank.entity';
import { LoanPaymentType } from '../disbursal/disbursement-transaction-log.entity';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Disburse, 2=>Status Check — legacy `disburse_method_id` comment. */
export enum DisbursementApiMethod {
  DISBURSE = 1,
  STATUS_CHECK = 2,
}

/**
 * Legacy `api_disburse_logs` — the real vendor disbursal API call (bank
 * transfer initiation), distinct from `DisbursementTransactionLog` (legacy
 * `lead_disbursement_trans_log`, a coarse status/audit trail with no
 * request/response payloads). This is the actual ICICI disbursal API
 * integration log, with encrypted request/response and beneficiary account
 * details.
 */
@Entity('api_disburse_logs')
export class DisbursementApiLog {
  @PrimaryGeneratedColumn({
    name: 'disburse_log_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'disburse_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'disburse_lead_id' })
  lead: Lead;

  @Column({
    name: 'disburse_bank_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  disbursementBankId: number | null;

  @ManyToOne(() => DisbursementBank, { nullable: true })
  @JoinColumn({ name: 'disburse_bank_id' })
  disbursementBank: DisbursementBank | null;

  @Column({
    name: 'disburse_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'disburse_user_id' })
  user: User | null;

  @Column({ name: 'disburse_method_id', type: 'mediumint', unsigned: true })
  method: DisbursementApiMethod;

  @Column({
    name: 'disburse_trans_type_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  transactionType: LoanPaymentType | null;

  @Column({
    name: 'disburse_trans_refno',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceNo: string | null;

  @Column({
    name: 'disburse_bank_reference_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankReferenceNo: string | null;

  @Column({
    name: 'disburse_payment_reference_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReferenceNo: string | null;

  @Column({
    name: 'disburse_lan_no',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  loanNumber: string | null;

  @Column({
    name: 'disburse_beneficiary_account_no',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  beneficiaryAccountNumber: string | null;

  @Column({
    name: 'disburse_beneficiary_ifsc_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  beneficiaryIfscCode: string | null;

  @Column({
    name: 'disburse_beneficiary_name',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  beneficiaryName: string | null;

  @Column({ name: 'disburse_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'disburse_response', type: 'text', nullable: true })
  response: string | null;

  @Column({
    name: 'disburse_encrypted_request',
    type: 'longtext',
    nullable: true,
  })
  encryptedRequest: string | null;

  @Column({
    name: 'disburse_encrypted_response',
    type: 'longtext',
    nullable: true,
  })
  encryptedResponse: string | null;

  @Column({ name: 'disburse_api_status_id', type: 'mediumint', unsigned: true })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'disburse_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({
    name: 'disburse_request_datetime',
    type: 'datetime',
    nullable: true,
  })
  requestedAt: Date | null;

  @Column({
    name: 'disburse_response_datetime',
    type: 'datetime',
    nullable: true,
  })
  respondedAt: Date | null;

  @Column({
    name: 'disburse_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
  })
  isActive: boolean;

  @Column({
    name: 'disburse_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  isDeleted: boolean;
}
