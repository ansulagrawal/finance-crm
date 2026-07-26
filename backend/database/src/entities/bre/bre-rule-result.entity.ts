import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { BreRule } from './bre-rule.entity';

/** 1=>Approve(d), 2=>Refer(red), 3=>Reject(ed) — legacy comment on both decision columns. */
export enum BreDecision {
  APPROVE = 1,
  REFER = 2,
  REJECT = 3,
}

/** Legacy `lead_bre_rule_result` (confirmed against a real UAT export). */
@Entity('lead_bre_rule_result')
export class BreRuleResult {
  @PrimaryGeneratedColumn({ name: 'lbrr_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lbrr_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lbrr_lead_id' })
  lead: Lead;

  @Column({ name: 'lbrr_rule_id', type: 'int', unsigned: true })
  ruleId: number;

  @ManyToOne(() => BreRule, { nullable: false })
  @JoinColumn({ name: 'lbrr_rule_id' })
  rule: BreRule;

  /** Denormalized snapshot of `rule.name` at evaluation time, not a live join. */
  @Column({ name: 'lbrr_rule_name', type: 'varchar', length: 200 })
  ruleName: string;

  @Column({ name: 'lbrr_rule_cutoff_value', type: 'varchar', length: 500 })
  cutoffValue: string;

  @Column({ name: 'lbrr_rule_actual_value', type: 'varchar', length: 500 })
  actualValue: string;

  @Column({ name: 'lbrr_rule_relevant_inputs', type: 'varchar', length: 500 })
  relevantInputs: string;

  @Column({
    name: 'lbrr_rule_system_decision_id',
    type: 'mediumint',
    unsigned: true,
    default: 0,
  })
  systemDecision: BreDecision | 0;

  @Column({
    name: 'lbrr_rule_manual_decision_id',
    type: 'mediumint',
    unsigned: true,
    default: 0,
  })
  manualDecision: BreDecision | 0;

  @Column({
    name: 'lbrr_rule_manual_decision_remarks',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  manualDecisionRemarks: string | null;

  @Column({ name: 'lbrr_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'lbrr_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'lbrr_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'lbrr_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
