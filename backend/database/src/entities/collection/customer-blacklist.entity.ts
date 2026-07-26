import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { BlacklistReason } from './blacklist-reason.entity';

/**
 * Legacy `customer_black_list` (confirmed against a real UAT export) — a
 * **global identity blacklist**, not a per-lead flag. Legacy's
 * `checkBlackListedCustomer()` (`BreRuleModel.class.php`) matches a new lead
 * against every prior blacklist row by PAN, mobile/alternate-mobile,
 * email/alternate-email, or (first name + DOB) — across ALL leads, not just
 * the one that originally triggered the entry. The identity columns below
 * are a snapshot captured at blacklist-creation time, so a later profile
 * edit on the original lead doesn't retroactively change who gets blocked.
 */
@Entity('customer_black_list')
export class CustomerBlacklist {
  @PrimaryGeneratedColumn({ name: 'bl_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'bl_lead_id', type: 'bigint', nullable: true })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'bl_lead_id' })
  lead: Lead | null;

  @Column({ name: 'bl_reason_id', type: 'int', unsigned: true, nullable: true })
  reasonId: number | null;

  @ManyToOne(() => BlacklistReason, { nullable: true })
  @JoinColumn({ name: 'bl_reason_id' })
  reason: BlacklistReason | null;

  @Column({
    name: 'bl_created_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'bl_created_user_id' })
  createdBy: User | null;

  @Column({
    name: 'bl_reason_remark',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  remarks: string | null;

  @Column({
    name: 'bl_customer_first_name',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  firstName: string | null;

  @Column({ name: 'bl_customer_dob', type: 'date', nullable: true })
  dob: string | null;

  @Column({ name: 'bl_customer_pancard', type: 'varchar', length: 15 })
  pancard: string;

  @Column({
    name: 'bl_customer_mobile',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  mobile: string | null;

  @Column({
    name: 'bl_customer_alternate_mobile',
    type: 'bigint',
    nullable: true,
    transformer: numericString,
  })
  alternateMobile: string | null;

  @Column({ name: 'bl_customer_email', type: 'varchar', length: 150 })
  email: string;

  @Column({
    name: 'bl_customer_alternate_email',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  alternateEmail: string | null;

  @Column({ name: 'bl_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'bl_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'bl_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'bl_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
    this.alternateEmail =
      this.alternateEmail?.toLowerCase() ?? this.alternateEmail;
  }
}
