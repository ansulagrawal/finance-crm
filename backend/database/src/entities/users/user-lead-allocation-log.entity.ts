import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { User } from './user.entity';

/** 1=>Active, 2=>Inactive — legacy `user_lead_allocation_log.ula_user_status` comment. */
export enum UserLeadAllocationStatus {
  ACTIVE = 1,
  INACTIVE = 2,
}

/** 1=>FRESH, 2=>REPEAT — legacy `user_lead_allocation_log.ula_user_case_type` comment. */
export enum UserLeadAllocationCaseType {
  FRESH = 1,
  REPEAT = 2,
}

/**
 * Legacy `user_lead_allocation_log` (confirmed in `legacy-schema.sql`/
 * `init.sql`) — a screener/credit-manager's self-declared daily
 * availability, written by `LoginController::leadAllocation()` (a form on
 * the user's own profile page, `CR1`/`CR2` only) and read back by
 * `Report_Model::CurrentBucketStatusModel()` to annotate that day's
 * portfolio snapshot. **Not** consumed by the real production allocation
 * cron (`Automate::allocateLeadsAndApplication`, ported as
 * `AllocateLeadsAndApplicationService`) — that job already uses
 * `UserActivityLog`'s login-today signal instead. The `CronSanctionController`
 * methods that do read this table for allocation eligibility are confirmed,
 * via the real production crontab, not to run in production — see
 * docs/TODO.md.
 */
@Entity('user_lead_allocation_log')
export class UserLeadAllocationLog {
  @PrimaryGeneratedColumn({ name: 'ula_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'ula_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'ula_user_id' })
  user: User;

  @Column({
    name: 'ula_user_status',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  userStatus: UserLeadAllocationStatus;

  @Column({
    name: 'ula_user_case_type',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  userCaseType: UserLeadAllocationCaseType;

  @Column({ name: 'ula_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'ula_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'ula_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
