import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { DisbursementBank } from './disbursement-bank.entity';

/** 1=>initiated, 2=>pending, 3=>failed, 4=>hold, 5=>completed — legacy `disb_trans_status_id` comment. */
export enum DisbursementTransactionStatus {
  INITIATED = 1,
  PENDING = 2,
  FAILED = 3,
  HOLD = 4,
  COMPLETE = 5,
}

/**
 * 1=>Online, 2=>Offline — shared by `loan.loan_disbursement_payment_mode_id`
 * and `disb_trans_payment_mode_id` below. Defined here (not in `loan.entity.ts`)
 * so `Loan` can import from this file without a circular import — `Loan` FKs
 * to `DisbursementTransactionLog`, never the other way around.
 */
export enum LoanPaymentMode {
  ONLINE = 1,
  OFFLINE = 2,
}

/** 1=>IMPS, 2=>NEFT — shared by `loan.loan_disbursement_payment_type_id` and `disb_trans_payment_type_id` below. */
export enum LoanPaymentType {
  IMPS = 1,
  NEFT = 2,
}

/** Legacy `lead_disbursement_trans_log` (confirmed against a real UAT export). */
@Entity('lead_disbursement_trans_log')
export class DisbursementTransactionLog {
  @PrimaryGeneratedColumn({
    name: 'disb_trans_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'disb_trans_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'disb_trans_lead_id' })
  lead: Lead;

  @Column({
    name: 'disb_trans_reference_no',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceNo: string | null;

  @Column({ name: 'disb_trans_bank_id', type: 'mediumint' })
  bankId: number;

  @ManyToOne(() => DisbursementBank, { nullable: false })
  @JoinColumn({ name: 'disb_trans_bank_id' })
  bank: DisbursementBank;

  @Column({
    name: 'disb_trans_payment_mode_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  paymentMode: LoanPaymentMode | null;

  @Column({
    name: 'disb_trans_payment_type_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  paymentType: LoanPaymentType | null;

  @Column({
    name: 'disb_trans_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  status: DisbursementTransactionStatus | null;

  @Column({
    name: 'disb_trans_created_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @Column({ name: 'disb_trans_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'disb_trans_updated_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  updatedById: number | null;

  @Column({ name: 'disb_trans_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'disb_trans_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'disb_trans_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
