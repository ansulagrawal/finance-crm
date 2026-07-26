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
import { User } from '../users/user.entity';

/** 0=>Not Recommend or Sanction, 1=>Recommend or Sanction — legacy `cam_status` comment. */
export enum CamStatus {
  DRAFT = 0,
  SANCTION = 1,
}

/**
 * Legacy `credit_analysis_memo` (confirmed against a real UAT export). Only
 * the columns `migrate-legacy/migrate-cam-bre.ts` already proved are read
 * elsewhere are mapped; legacy's remaining ~30 columns (salary-credit
 * detection inputs, GST breakdown, eSign audit trail) are left unmapped.
 */
@Entity('credit_analysis_memo')
export class CreditAnalysisMemo {
  @PrimaryGeneratedColumn({ name: 'cam_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @OneToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  /** Legacy `updated_by`, falling back to `created_by` — whichever user last
   * touched the row at sanction time (see migrate-cam-bre.ts). */
  @Column({ name: 'updated_by', type: 'int', unsigned: true, nullable: true })
  sanctionedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  sanctionedBy: User | null;

  @Column({ name: 'loan_recommended', type: 'int', nullable: true })
  recommendedLoanAmount: number | null;

  @Column({
    name: 'roi',
    type: 'double',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  roi: number | null;

  @Column({ name: 'panel_roi', type: 'float', nullable: true })
  penalRoi: number | null;

  @Column({ name: 'tenure', type: 'int', nullable: true })
  tenureDays: number | null;

  @Column({ name: 'processing_fee_percent', type: 'float', nullable: true })
  processingFeePercent: number | null;

  /** Legacy `admin_fee` — processing fee inclusive of GST. */
  @Column({ name: 'admin_fee', type: 'double', nullable: true })
  adminFee: number | null;

  @Column({ name: 'net_disbursal_amount', type: 'double', nullable: true })
  netDisbursalAmount: number | null;

  @Column({ name: 'repayment_amount', type: 'double', nullable: true })
  repaymentAmount: number | null;

  @Column({ name: 'disbursal_date', type: 'date', nullable: true })
  disbursalDate: Date | null;

  @Column({ name: 'repayment_date', type: 'date', nullable: true })
  repaymentDate: Date | null;

  /**
   * Interest deducted upfront at disbursal rather than collected at
   * repayment — read by `CommonComponent::get_loan_repayment_details()`'s
   * reconciliation math (`$advance_interest_amount_deducted`). Confirmed a
   * real, pre-existing `credit_analysis_memo` column via `legacy-schema.sql`
   * — not an additive change, previously just unmapped.
   */
  @Column({
    name: 'cam_advance_interest_amount',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  advanceInterestAmount: number | null;

  @Column({ name: 'eligible_foir_percentage', type: 'float', nullable: true })
  eligibleFoirPercentage: number | null;

  @Column({ name: 'final_foir_percentage', type: 'float', nullable: true })
  finalFoirPercentage: number | null;

  @Column({
    name: 'cam_appraised_monthly_income',
    type: 'double',
    nullable: true,
    default: 0,
  })
  appraisedMonthlyIncome: number | null;

  @Column({
    name: 'cam_appraised_obligations',
    type: 'double',
    nullable: true,
    default: 0,
  })
  appraisedObligations: number | null;

  @Column({
    name: 'cam_risk_profile',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  riskProfile: string | null;

  @Column({
    name: 'cam_risk_score',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  riskScore: number | null;

  @Column({
    name: 'cam_sanction_letter_file_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  sanctionLetterFileName: string | null;

  @Column({
    name: 'cam_sanction_letter_esgin_file_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  sanctionLetterESignedFileName: string | null;

  @Column({
    name: 'cam_sanction_letter_esgin_on',
    type: 'datetime',
    nullable: true,
  })
  sanctionLetterESignedAt: Date | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remarks: string | null;

  @Column({
    name: 'cam_sanction_remarks',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  sanctionRemarks: string | null;

  @Column({
    name: 'cam_status',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  status: CamStatus | null;

  @Column({ name: 'created_by', type: 'int', unsigned: true, nullable: true })
  createdById: number | null;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'cam_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'cam_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /**
   * Confirmed against a real prod schema export (absent from the UAT
   * baseline, DB comment "sanction recovered file"); no legacy PHP source
   * sets or reads it, so no service currently writes this column either.
   */
  @Column({
    name: 'sanction_letter_recovery_status',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  sanctionLetterRecoveryStatus: boolean;
}
