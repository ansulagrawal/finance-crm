import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';

/** 1=regular, 2=settlement, 3=write off, 4=discount — legacy `wavier_status` comment. */
export enum VisitWaiverStatus {
  REGULAR = 1,
  SETTLEMENT = 2,
  WRITE_OFF = 3,
  DISCOUNT = 4,
}

/**
 * Legacy `tbl_collection_followup` (confirmed against a real UAT export) —
 * GPS/visit-shaped: lat/long, visit address, collection photo. Only the
 * columns `migrate-legacy/migrate-collection.ts` already proved matter are
 * fully typed; legacy's payment-capture columns (`paid_amount`/
 * `payment_mode`/`payment_method`/`discounted_amount`) live on `Collection`
 * conceptually and are left unmapped here to avoid duplicating that data.
 */
@Entity('tbl_collection_followup')
export class LoanCollectionVisit {
  @PrimaryGeneratedColumn({
    name: 'followup_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true, nullable: true })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'loan_no', type: 'varchar', length: 30, nullable: true })
  loanNumber: string | null;

  @Column({ name: 'user_id', type: 'int', unsigned: true, nullable: true })
  requestedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  requestedBy: User | null;

  @Column({ name: 'updated_by', type: 'int', unsigned: true, nullable: true })
  allocatedToId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  allocatedTo: User | null;

  @Column({
    name: 'visit_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  visitAddress: string | null;

  @Column({ name: 'executive_start_letitude', type: 'double', nullable: true })
  startLatitude: number | null;

  @Column({ name: 'executive_start_longitude', type: 'double', nullable: true })
  startLongitude: number | null;

  @Column({ name: 'executive_ending_latitude', type: 'double', nullable: true })
  endLatitude: number | null;

  @Column({
    name: 'executive_ending_longitude',
    type: 'double',
    nullable: true,
  })
  endLongitude: number | null;

  @Column({ name: 'total_distance', type: 'double', nullable: true })
  totalDistanceKm: number | null;

  @Column({
    name: 'collection_img',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  collectionImageFileKey: string | null;

  @Column({
    name: 'reject_reason',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  rejectReason: string | null;

  @Column({
    name: 'followup_remark',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  remarks: string | null;

  @Column({ name: 'followup_started_at', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'followup_ended_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'next_visit_date', type: 'datetime', nullable: true })
  nextVisitAt: Date | null;

  @Column({ name: 'created_at', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'collection_followup_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'collection_followup_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
