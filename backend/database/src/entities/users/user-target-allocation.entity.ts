import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { User } from './user.entity';

/** 1=>Sanction Target, 2=>Collection Target — legacy `user_target_allocation_log.uta_type_id` comment. */
export enum UserTargetAllocationType {
  SANCTION = 1,
  COLLECTION = 2,
}

/**
 * Legacy `user_target_allocation_log` (`Performance_Model.php`). Unlike the
 * pre-restart entity, legacy stores achieved-to-date figures directly on the
 * row (updated by the legacy cron) rather than computing them live from
 * `CreditAnalysisMemo` — this entity is a faithful column-for-column adopt;
 * whether a service recomputes "achieved" live or trusts these columns is a
 * decision for the service rewrite, not this layer.
 */
@Entity('user_target_allocation_log')
export class UserTargetAllocation {
  @PrimaryGeneratedColumn({ name: 'uta_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'uta_type_id',
    type: 'tinyint',
    default: UserTargetAllocationType.SANCTION,
  })
  type: UserTargetAllocationType;

  @Column({ name: 'uta_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'uta_user_id' })
  user: User;

  @Column({
    name: 'uta_user_target_cases',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  targetCases: number | null;

  @Column({
    name: 'uta_user_target_amount',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  targetAmount: number | null;

  @Column({
    name: 'uta_user_achieve_cases',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  achievedCases: number | null;

  @Column({
    name: 'uta_user_achieve_amount',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  achievedAmount: number | null;

  @Column({
    name: 'uta_user_target_followups',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  targetFollowups: number | null;

  @Column({
    name: 'uta_user_achieve_followups',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  achievedFollowups: number | null;

  @Column({
    name: 'uta_user_loan_total_cases',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanTotalCases: number | null;

  @Column({
    name: 'uta_user_loan_total_principle',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanTotalPrinciple: number | null;

  @Column({
    name: 'uta_user_loan_payable_amount',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanPayableAmount: number | null;

  @Column({
    name: 'uta_user_loan_closed_cases',
    type: 'int',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanClosedCases: number | null;

  @Column({
    name: 'uta_user_loan_principle_received',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanPrincipleReceived: number | null;

  @Column({
    name: 'uta_user_loan_int_received',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanInterestReceived: number | null;

  @Column({
    name: 'uta_user_loan_total_received',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanTotalReceived: number | null;

  @Column({
    name: 'uta_user_loan_principle_outstanding',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanPrincipleOutstanding: number | null;

  @Column({
    name: 'uta_user_loan_interest_outstanding',
    type: 'double',
    unsigned: true,
    nullable: true,
    default: 0,
  })
  loanInterestOutstanding: number | null;

  @Column({ name: 'uta_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'uta_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'uta_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'uta_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
