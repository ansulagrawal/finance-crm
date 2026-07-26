import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Loan } from '../disbursal/loan.entity';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { PaymentMode } from './payment-mode.entity';

/** 0=Pending, 1=Approved, 2=Reject — legacy `payment_verification` comment. */
export enum CollectionVerificationStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

/**
 * Legacy `collection` (confirmed against a real UAT export). `loan` joins on
 * the existing `loan_no` varchar (matching `loan.loan_no`) rather than a
 * numeric FK — legacy never added one. Only the columns
 * `migrate-legacy/migrate-collection.ts` already proved matter are mapped.
 */
@Entity('collection')
export class Collection {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'loan_no', type: 'varchar', length: 20 })
  loanNumber: string;

  @ManyToOne(() => Loan, { nullable: true })
  @JoinColumn({ name: 'loan_no', referencedColumnName: 'loanNumber' })
  loan: Loan | null;

  @Column({
    name: 'payment_mode_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  paymentModeId: number | null;

  @ManyToOne(() => PaymentMode, { nullable: true })
  @JoinColumn({ name: 'payment_mode_id' })
  paymentMode: PaymentMode | null;

  /**
   * Legacy `repayment_type` is a numeric string matching `master_status.status_id`,
   * but stored as varchar against an int PK — TypeORM can't express that as a
   * relation cleanly, so this stays a plain column; resolve the `MasterStatus`
   * lookup at the service layer via `Number.parseInt(repaymentTypeId, 10)`.
   */
  @Column({ name: 'repayment_type', type: 'varchar', length: 255 })
  repaymentTypeId: string;

  @Column({
    name: 'collection_executive_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  collectionExecutiveId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'collection_executive_user_id' })
  collectionExecutive: User | null;

  @Column({
    name: 'closure_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  closedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closure_user_id' })
  closedBy: User | null;

  @Column({ name: 'received_amount', type: 'double', precision: 10, scale: 2 })
  receivedAmount: number;

  @Column({ name: 'discount', type: 'double', precision: 10, scale: 2 })
  discount: number;

  @Column({
    name: 'refund',
    type: 'double',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  refund: number | null;

  @Column({ name: 'refrence_no', type: 'varchar', length: 255, nullable: true })
  referenceNo: string | null;

  @Column({ name: 'date_of_recived', type: 'date', nullable: true })
  receivedDate: Date | null;

  @Column({
    name: 'payment_verification',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  verificationStatus: CollectionVerificationStatus;

  @Column({ name: 'remarks', type: 'varchar', length: 255 })
  remarks: string;

  @Column({
    name: 'closure_remarks',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  closureRemarks: string | null;

  @Column({
    name: 'closure_payment_updated_on',
    type: 'datetime',
    nullable: true,
  })
  closedAt: Date | null;

  @Column({ name: 'collection_executive_payment_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'collection_active',
    type: 'int',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'collection_deleted',
    type: 'int',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
