import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { MasterStatus } from '../master-status.entity';
import { User } from '../users/user.entity';

/** 1=>Pre Audit, else=>Post Audit — `Task_Model.php::get_list_audit_followup()`. */
export enum LeadAuditCaseType {
  PRE_AUDIT = 1,
  POST_AUDIT = 2,
}

/**
 * `ADOPT-UNVERIFIED` per docs/SCHEMA-MAP.md — legacy `lead_audit` is absent
 * from the UAT dump, but its real columns are known from
 * `old-php-files/application/models/Task_Model.php`'s
 * `get_list_audit_followup()` query. Confirm against production before
 * cutover; create this table only if production also lacks it.
 *
 * Supplementary audit-case metadata (assignee, case type, remarks) — NOT
 * the primary workflow trail. `LeadFollowup` is written on every audit
 * stage transition and is the source of truth for history; legacy wrote
 * this table inconsistently (only on pre/post-audit hand-off and
 * approval-reason notes), so it stays scoped the same way.
 */
@Entity('lead_audit')
export class LeadAudit {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'audit_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'audit_lead_id' })
  lead: Lead;

  @Column({
    name: 'audit_assign_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  assignedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'audit_assign_user_id' })
  assignedBy: User | null;

  @Column({
    name: 'audit_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  assignedToId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'audit_user_id' })
  assignedTo: User | null;

  @Column({ name: 'audit_assign_date_time', type: 'datetime', nullable: true })
  assignedAt: Date | null;

  @Column({
    name: 'audit_lead_status_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  leadStatusId: number | null;

  @ManyToOne(() => MasterStatus, { nullable: true })
  @JoinColumn({ name: 'audit_lead_status_id' })
  leadStatus: MasterStatus | null;

  @Column({
    name: 'audit_case_type_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  caseType: LeadAuditCaseType | null;

  @Column({
    name: 'audit_status',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  status: string | null;

  @Column({ name: 'audit_remarks', type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'audit_created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'audit_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'audit_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
