import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { MasterStatus } from '../master-status.entity';
import { User } from '../users/user.entity';
import { Lead } from './lead.entity';

/**
 * Legacy `lead_followup`. `status`/`stage`/`lead_followup_status_id` mirror
 * `leads`' own status trio (see `Lead`'s doc comment) rather than being a
 * separate lookup; `statusId` is the one FK'd to `MasterStatus` here.
 */
@Entity('lead_followup')
export class LeadFollowup {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({
    name: 'lead_followup_status_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  statusId: number | null;

  @ManyToOne(() => MasterStatus, { nullable: true })
  @JoinColumn({ name: 'lead_followup_status_id' })
  status: MasterStatus | null;

  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true })
  legacyStatus: string | null;

  @Column({ name: 'stage', type: 'varchar', length: 20, nullable: true })
  legacyStage: string | null;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string | null;

  @Column({
    name: 'scheduled_date',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  scheduledDate: string | null;

  @Column({ name: 'user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_on', type: 'datetime' })
  updatedAt: Date;

  @Column({
    name: 'lead_followup_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'lead_followup_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
