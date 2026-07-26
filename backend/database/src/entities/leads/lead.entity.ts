import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { Company } from '../company/company.entity';
import { Product } from '../company/product.entity';
import { Branch } from '../geography/branch.entity';
import { City } from '../geography/city.entity';
import { DataSource } from '../geography/data-source.entity';
import { State } from '../geography/state.entity';
import { MasterStatus } from '../master-status.entity';
import { User } from '../users/user.entity';
import { CifCustomer } from './cif-customer.entity';
import { CustomerProfile } from './customer-profile.entity';
import { RejectionReason } from './rejection-reason.entity';

/** Legacy `leads.user_type`. The hyphen in `UNPAID-REPEAT` is the stored value. */
export enum LeadUserType {
  NEW = 'NEW',
  REPEAT = 'REPEAT',
  UNPAID_REPEAT = 'UNPAID-REPEAT',
}

/** The exact value list of legacy `leads.status`, which is a MySQL enum. Kept in
 * step with `MasterStatus.name`. */
export const LEAD_STATUS_CODES = [
  'LEAD-NEW',
  'LEAD-INPROCESS',
  'LEAD-HOLD',
  'APPLICATION-NEW',
  'APPLICATION-INPROCESS',
  'APPLICATION-HOLD',
  'DUPLICATE',
  'SYSTEM-REJECT',
  'REJECT',
  'APPLICATION-RECOMMENDED',
  'APPLICATION-SEND-BACK',
  'SANCTION',
  'DISBURSE-PENDING',
  'DISBURSED',
  'CANCEL',
  'PART-PAYMENT',
  'CLOSED',
  'SETTLED',
  'WRITEOFF',
  'DISBURSAL-NEW',
  'DISBURSAL-INPROCESS',
  'DISBURSAL-HOLD',
  'DISBURSED-WAIVED',
  'DISBURSAL-SEND-BACK',
  'LEAD-REGISTRATION',
  'LEAD-PARTIAL',
  'AUDIT-NEW',
  'AUDIT-INPROCESS',
  'AUDIT-HOLD',
  'AUDIT-RECOMMENDED',
  'TEST-LEAD',
] as const;
export type LeadStatusCode = (typeof LEAD_STATUS_CODES)[number];

/** The exact value list of legacy `leads.stage`, which is a MySQL enum. Kept in
 * step with `MasterStatus.stageCode`. */
export const LEAD_STAGE_CODES = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
  'S11',
  'S12',
  'S13',
  'S14',
  'S15',
  'S16',
  'S17',
  'S18',
  'S19',
  'S20',
  'S21',
  'S22',
  'S25',
  'S30',
  'S31',
  'S32',
  'S33',
  'S34',
  'S49',
] as const;
export type LeadStageCode = (typeof LEAD_STAGE_CODES)[number];

/**
 * Legacy `leads` (114 columns) — the busiest table in the schema and the one
 * the customer-facing app-server install touches most (318 references in
 * `old-php-files/api/`). Additive changes only.
 *
 * **The status trio must stay in sync.** Legacy carries `lead_status_id`
 * (numeric FK), `status` (a 31-value enum) and `stage` (`S1`..`S49`), all three
 * NOT NULL or read by the app server, and they agree on every existing row:
 * `lead_status_id` = `master_status.status_id`, `status` = `status_name`,
 * `stage` = `status_stage`. So all three are mapped and every write that sets
 * `leadStatus` must set `legacyStatus` and `legacyStage` from the same
 * `MasterStatus` row. They are not redundant here — dropping them would break
 * the mobile apps.
 *
 * `cifCustomer` joins on the existing `customer_id`/`cif_number` varchar
 * pair rather than a numeric FK — legacy never added one, and this rewrite
 * doesn't either.
 */
@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn({ name: 'lead_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'company_id', type: 'smallint', unsigned: true })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_id', type: 'smallint', unsigned: true })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => DataSource, { nullable: true })
  @JoinColumn({ name: 'lead_data_source_id' })
  dataSource: DataSource | null;

  @ManyToOne(() => State, { nullable: true })
  @JoinColumn({ name: 'state_id' })
  state: State | null;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  city: City | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'lead_branch_id' })
  branch: Branch | null;

  @ManyToOne(() => MasterStatus, { nullable: true })
  @JoinColumn({ name: 'lead_status_id' })
  leadStatus: MasterStatus | null;

  /** Legacy `leads.status`, NOT NULL — must match `leadStatus.name`. */
  @Column({ name: 'status', type: 'enum', enum: LEAD_STATUS_CODES })
  legacyStatus: LeadStatusCode;

  /** Legacy `leads.stage`, NOT NULL — must match `leadStatus.stageCode`. */
  @Column({ name: 'stage', type: 'enum', enum: LEAD_STAGE_CODES })
  legacyStage: LeadStageCode;

  @ManyToOne(() => RejectionReason, { nullable: true })
  @JoinColumn({ name: 'lead_rejected_reason_id' })
  rejectionReason: RejectionReason | null;

  /** Legacy `leads.customer_id` — a varchar holding the CIF number string
   * itself (`cif_customer.cif_number`), not a numeric FK. Set at sanction
   * time. No new column: this reuses the existing legacy link instead of
   * adding one. */
  @Column({ name: 'customer_id', type: 'varchar', length: 20, nullable: true })
  cifNumber: string | null;

  @ManyToOne(() => CifCustomer, { nullable: true })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'cifNumber' })
  cifCustomer: CifCustomer | null;

  /** Legacy `leads.lead_customer_profile_id` — links to the customer's
   * self-registered app/website profile, see `CustomerProfile`'s doc
   * comment. */
  @Column({
    name: 'lead_customer_profile_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  customerProfileId: number | null;

  @ManyToOne(() => CustomerProfile, { nullable: true })
  @JoinColumn({ name: 'lead_customer_profile_id' })
  customerProfile: CustomerProfile | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_screener_assign_user_id' })
  screenerAssignedTo: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_credit_assign_user_id' })
  creditAssignedTo: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_disbursal_assign_user_id' })
  disbursalAssignedTo: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_rejected_user_id' })
  rejectedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_audit_assign_user_id' })
  auditAssignedTo: User | null;

  @Column({
    name: 'application_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  applicationNo: string | null;

  @Column({
    name: 'lead_reference_no',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  leadReferenceNo: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  firstName: string;

  @Column({
    name: 'mobile',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  mobile: string;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'pancard', type: 'varchar', length: 15, nullable: true })
  pancard: string | null;

  @Column({
    name: 'loan_amount',
    type: 'double',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  loanAmount: number | null;

  @Column({ name: 'tenure', type: 'int', nullable: true })
  tenureDays: number | null;

  @Column({ name: 'purpose', type: 'varchar', length: 100, nullable: true })
  purpose: string | null;

  @Column({
    name: 'obligations',
    type: 'double',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  obligations: number | null;

  @Column({
    name: 'monthly_salary_amount',
    type: 'double',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  monthlySalaryAmount: number | null;

  @Column({ name: 'cibil', type: 'int', nullable: true })
  cibilScore: number | null;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: LeadUserType,
    nullable: true,
    default: LeadUserType.NEW,
  })
  userType: LeadUserType;

  @Column({
    name: 'pincode',
    type: 'int',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  pincode: string | null;

  @Column({ name: 'source', type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ name: 'utm_source', type: 'varchar', length: 256, nullable: true })
  utmSource: string | null;

  @Column({
    name: 'utm_campaign',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  utmCampaign: string | null;

  @Column({ name: 'utm_medium', type: 'varchar', length: 255, nullable: true })
  utmMedium: string | null;

  @Column({ name: 'utm_term', type: 'varchar', length: 255, nullable: true })
  utmTerm: string | null;

  @Column({
    name: 'lead_black_list_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isBlacklisted: boolean;

  @Column({
    name: 'lead_is_mobile_verified',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isMobileVerified: boolean;

  @Column({
    name: 'lead_stp_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isStraightThroughProcessing: boolean;

  @Column({ name: 'lead_entry_date', type: 'date', nullable: true })
  leadEntryDate: Date | null;

  @Column({ name: 'scheduled_date', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({
    name: 'lead_screener_assign_datetime',
    type: 'datetime',
    nullable: true,
  })
  screenerAssignedAt: Date | null;

  @Column({
    name: 'lead_credit_assign_datetime',
    type: 'datetime',
    nullable: true,
  })
  creditAssignedAt: Date | null;

  @Column({
    name: 'lead_credit_approve_datetime',
    type: 'datetime',
    nullable: true,
  })
  creditApprovedAt: Date | null;

  @Column({
    name: 'lead_disbursal_assign_datetime',
    type: 'datetime',
    nullable: true,
  })
  disbursalAssignedAt: Date | null;

  @Column({
    name: 'lead_disbursal_approve_datetime',
    type: 'datetime',
    nullable: true,
  })
  disbursalApprovedAt: Date | null;

  @Column({ name: 'lead_final_disbursed_date', type: 'date', nullable: true })
  finalDisbursedAt: Date | null;

  @Column({ name: 'lead_rejected_datetime', type: 'datetime', nullable: true })
  rejectedAt: Date | null;

  @Column({
    name: 'lead_audit_assign_date_time',
    type: 'datetime',
    nullable: true,
  })
  auditAssignedAt: Date | null;

  /** Legacy `audit_send_back` — set when an auditor sends the lead back to
   * credit, routing a resubmission to AUDIT-INPROCESS rather than AUDIT-NEW.
   * Stored as `smallint` here, unlike the `tinyint` flags elsewhere. */
  @Column({
    name: 'audit_send_back',
    type: 'smallint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isAuditSendBack: boolean;

  /** Legacy `lead_direct_disbursal` — marks a REPEAT-customer lead that skips
   * normal screening, read by `RepeatOnlineCustomersAllocationService`. */
  @Column({
    name: 'lead_direct_disbursal',
    type: 'tinyint',
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  leadDirectDisbursal: boolean;

  /** Legacy `lead_credeau_status`, NOT NULL — Credeau alternate-data decision. */
  @Column({ name: 'lead_credeau_status', type: 'tinyint', default: 0 })
  credeauStatus: number;

  /** Legacy `lead_rejected_assign_counter`, NOT NULL — how many times the lead
   * has been reassigned after rejection. */
  @Column({
    name: 'lead_rejected_assign_counter',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  rejectedAssignCounter: number;

  /** Legacy `lead_creation_mode`, NOT NULL. */
  @Column({ name: 'lead_creation_mode', type: 'tinyint', default: 0 })
  creationMode: number;

  /** Legacy `lead_process_mode`, NOT NULL. */
  @Column({ name: 'lead_process_mode', type: 'tinyint', default: 0 })
  processMode: number;

  @CreateDateColumn({ name: 'created_on', type: 'datetime', precision: null })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  updatedAt: Date;

  @Column({
    name: 'lead_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'lead_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
  }

  /**
   * Keeps legacy's `status` and `stage` in step with `lead_status_id`.
   *
   * Nineteen places across core-api and automation-worker assign
   * `lead.leadStatus = someStatus`, and the app-server install reads `status`
   * and `stage` rather than the id. Deriving them here means no caller can
   * forget, instead of nineteen call sites each having to remember.
   *
   * Only fires on `save()` of a loaded entity — a bare `repository.update()`
   * that changed the status id would bypass it, so status transitions must go
   * through `save()`.
   */
  @BeforeInsert()
  @BeforeUpdate()
  syncLegacyStatusColumns(): void {
    if (this.leadStatus) {
      this.legacyStatus = this.leadStatus.name as LeadStatusCode;
      this.legacyStage = this.leadStatus.stageCode as LeadStageCode;
    }
  }
}
