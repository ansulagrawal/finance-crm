import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { DisbursementBank } from './disbursement-bank.entity';
import {
  DisbursementTransactionLog,
  LoanPaymentMode,
  LoanPaymentType,
} from './disbursement-transaction-log.entity';

/** 1=>Collection Pending, 2=>Recovery Pending, 3=>Legal — legacy `loan_recovery_status_id` comment. */
export enum LoanRecoveryStage {
  COLLECTION_PENDING = 1,
  RECOVERY_PENDING = 2,
  LEGAL_PENDING = 3,
}

/**
 * Legacy `loan` (confirmed against a real UAT export). `status` is legacy's
 * free-string lifecycle label (`SANCTION`/`DISBURSAL-*`/`DISBURSED`/`CLOSED`/
 * `SETTLED`/`WRITEOFF`/...), the same value space as `Lead.legacyStatus` —
 * this rewrite doesn't collapse it into a simplified enum. Only the columns
 * `migrate-legacy/migrate-loan-disbursal.ts` already proved matter are
 * mapped; legacy's agreement/eSign/NOC-letter/bureau-reporting columns are
 * left unmapped. There is no legacy `loan_post_audit_flag` column anywhere in
 * the schema — `Lead.auditAssignedTo`/`auditAssignedAt`/`isAuditSendBack`
 * already cover post-disbursal audit tracking.
 */
@Entity('loan')
export class Loan {
  @PrimaryGeneratedColumn({ name: 'loan_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @OneToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'loan_no', type: 'varchar', length: 20, nullable: true })
  loanNumber: string | null;

  /** Free-string legacy status — see class doc comment. */
  @Column({ name: 'status', type: 'varchar', length: 255 })
  status: string;

  @Column({
    name: 'loan_disbursement_bank_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  disbursementBankId: number | null;

  @ManyToOne(() => DisbursementBank, { nullable: true })
  @JoinColumn({ name: 'loan_disbursement_bank_id' })
  disbursementBank: DisbursementBank | null;

  @Column({
    name: 'loan_disbursement_payment_mode_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  paymentMode: LoanPaymentMode | null;

  @Column({
    name: 'loan_disbursement_payment_type_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  paymentType: LoanPaymentType | null;

  @Column({
    name: 'disburse_refrence_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  disbursementReferenceNo: string | null;

  @Column({
    name: 'loan_disbursement_trans_log_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  disbursementTransactionLogId: number | null;

  @ManyToOne(() => DisbursementTransactionLog, { nullable: true })
  @JoinColumn({ name: 'loan_disbursement_trans_log_id' })
  disbursementTransactionLog: DisbursementTransactionLog | null;

  @Column({
    name: 'loan_principle_payable_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  principalPayable: number | null;

  @Column({
    name: 'loan_interest_payable_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  interestPayable: number | null;

  @Column({
    name: 'loan_penalty_payable_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  penaltyPayable: number | null;

  @Column({
    name: 'loan_principle_received_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  principalReceived: number | null;

  @Column({
    name: 'loan_interest_received_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  interestReceived: number | null;

  @Column({
    name: 'loan_penalty_received_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  penaltyReceived: number | null;

  @Column({
    name: 'loan_principle_outstanding_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  principalOutstanding: number | null;

  @Column({
    name: 'loan_interest_outstanding_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  interestOutstanding: number | null;

  @Column({
    name: 'loan_penalty_outstanding_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  penaltyOutstanding: number | null;

  @Column({
    name: 'loan_total_payable_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  totalPayable: number | null;

  @Column({
    name: 'loan_total_received_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  totalReceived: number | null;

  @Column({
    name: 'loan_total_outstanding_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  totalOutstanding: number | null;

  @Column({
    name: 'loan_total_discount_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  totalDiscount: number | null;

  /**
   * The 3 individual discount-amount columns `get_loan_repayment_details()`
   * allocates `total_discount_amount` across, differently per repayment
   * type/timing — real, pre-existing `loan` columns confirmed via
   * `legacy-schema.sql`, previously just unmapped alongside `totalDiscount`.
   */
  @Column({
    name: 'loan_principle_discount_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  principalDiscount: number | null;

  @Column({
    name: 'loan_interest_discount_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  interestDiscount: number | null;

  @Column({
    name: 'loan_penalty_discount_amount',
    type: 'double',
    nullable: true,
    default: 0,
  })
  penaltyDiscount: number | null;

  @Column({ name: 'loan_settled_date', type: 'date', nullable: true })
  settledAt: Date | null;

  @Column({ name: 'loan_closure_date', type: 'date', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'loan_writeoff_date', type: 'date', nullable: true })
  writtenOffAt: Date | null;

  @Column({
    name: 'loan_recovery_status_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  recoveryStage: LoanRecoveryStage | null;

  @Column({ name: 'created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'loan_active',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'loan_deleted',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  @Column({
    name: 'loan_enach_mandate_registration_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  enachMandateRegistrationNo: string | null;

  @Column({ name: 'loan_enach_mandate_datetime', type: 'date', nullable: true })
  enachMandateDate: Date | null;

  /**
   * Confirmed against a real prod schema export; absent from the UAT
   * baseline. `api_enach_transaction_schedule_logs` (the table
   * `payday_enach_api.php`'s `TRANSACTION_INITIATE` flow logs to,
   * `aetl_requested_amount`/`aetl_deduct_request_date`/`aetl_request_id`/
   * `aetl_status_id`) doesn't exist as a real table in either schema —
   * these 4 columns match its fields by type/shape and appear to be
   * prod's replacement: the latest schedule snapshot lives directly on
   * `loan` instead of a separate log table. `enachScheduleStatus`'s value
   * space isn't independently confirmed beyond legacy's `$apiStatusId`
   * convention (1=success; 2/3/4 are distinct failure causes) — stored as
   * a raw number, not an enum, since prod's column carries no DB comment.
   */
  @Column({
    name: 'loan_enach_schedule_amount',
    type: 'int',
    nullable: true,
  })
  enachScheduleAmount: number | null;

  @Column({ name: 'loan_enach_schedule_date', type: 'date', nullable: true })
  enachScheduleDate: Date | null;

  /**
   * Confirmed against a real prod schema export: `NOT NULL` with no
   * DB-level `DEFAULT`. Legacy's own insert always supplies a value for
   * every mapped column (never actually hit this constraint), but
   * `DisbursalService.createLoan()` leaves this unset on a brand-new loan
   * — TypeORM omits an `undefined` property from the generated `INSERT`,
   * which MySQL would reject outright against the real column. `default:
   * ''` makes TypeORM supply the same empty-string value legacy would
   * have, so every insert path is safe without having to remember to set
   * this explicitly.
   */
  @Column({
    name: 'loan_enach_schedule_identifier',
    type: 'varchar',
    length: 200,
    nullable: false,
    default: '',
  })
  enachScheduleIdentifier: string;

  @Column({
    name: 'loan_enach_schedule_status',
    type: 'tinyint',
    nullable: true,
  })
  enachScheduleStatus: number | null;
}
