import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { BankAccountStatus } from './bank-account-status.entity';

/**
 * Legacy `customer_banking` (confirmed against a real UAT export).
 * `account_type` is a free-text varchar in legacy (`'SAVINGS'`/`'CURRENT'`/...),
 * not a numeric FK to `master_bank_type` — no relation is modeled for it.
 * `account_status_id` IS a real FK — see `BankAccountStatus`'s doc comment.
 */
@Entity('customer_banking')
export class CustomerBanking {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true, nullable: true })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100 })
  bankName: string;

  @Column({ name: 'ifsc_code', type: 'varchar', length: 20 })
  ifscCode: string;

  @Column({ name: 'account', type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ name: 'confirm_account', type: 'varchar', length: 20 })
  confirmAccountNumber: string;

  @Column({
    name: 'beneficiary_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  beneficiaryName: string | null;

  @Column({ name: 'branch', type: 'varchar', length: 255, nullable: true })
  branch: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 30, nullable: true })
  accountType: string | null;

  @Column({
    name: 'account_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  accountStatusId: number | null;

  @ManyToOne(() => BankAccountStatus, { nullable: true })
  @JoinColumn({ name: 'account_status_id' })
  accountStatus: BankAccountStatus | null;

  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true })
  remarks: string | null;

  @Column({ name: 'created_by', type: 'int', unsigned: true, nullable: true })
  createdById: number | null;

  @Column({ name: 'created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_by', type: 'int', unsigned: true, nullable: true })
  updatedById: number | null;

  @Column({ name: 'updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'customer_banking_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'customer_banking_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
