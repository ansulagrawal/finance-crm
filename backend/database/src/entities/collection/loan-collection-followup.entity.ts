import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { FollowupStatus } from './followup-status.entity';
import { FollowupType } from './followup-type.entity';

/** Legacy `loan_collection_followup` (confirmed against a real UAT export). */
@Entity('loan_collection_followup')
export class LoanCollectionFollowup {
  @PrimaryGeneratedColumn({ name: 'lcf_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lcf_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lcf_lead_id' })
  lead: Lead;

  @Column({ name: 'lcf_type_id', type: 'int', unsigned: true, default: 0 })
  typeId: number;

  @ManyToOne(() => FollowupType, { nullable: false })
  @JoinColumn({ name: 'lcf_type_id' })
  type: FollowupType;

  @Column({ name: 'lcf_status_id', type: 'int', unsigned: true, default: 0 })
  statusId: number;

  @ManyToOne(() => FollowupStatus, { nullable: true })
  @JoinColumn({ name: 'lcf_status_id' })
  status: FollowupStatus | null;

  @Column({ name: 'lcf_remarks', type: 'varchar', length: 500, nullable: true })
  remarks: string | null;

  @Column({
    name: 'lcf_next_schedule_datetime',
    type: 'datetime',
    nullable: true,
  })
  nextFollowupAt: Date | null;

  @Column({
    name: 'lcf_fe_upload_selfie',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fieldExecutiveSelfieFileKey: string | null;

  @Column({
    name: 'lcf_fe_upload_location',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  fieldExecutiveLocation: string | null;

  @Column({ name: 'lcf_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'lcf_user_id' })
  user: User;

  @Column({ name: 'lcf_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'lcf_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'lcf_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  @Column({ name: 'total_distance_covered', type: 'double', nullable: true })
  totalDistanceCoveredKm: number | null;

  @Column({
    name: 'lcf_runo_call_log_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  runoCallLogId: string | null;

  @Column({
    name: 'lcf_runo_call_mobile',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  runoCallMobile: string | null;
}
