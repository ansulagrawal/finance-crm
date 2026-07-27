import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_bank_account_status` — the lookup `customer_banking.
 * account_status_id` is a real FK against (the column carries the DB
 * comment `'master_bank_account_status id'`). `database/legacy-baseline/
 * legacy-schema.sql` is a schema-only dump (no rows for any table), but
 * the real 5-row `bas_name` set was confirmed against a real production
 * export supplied for this purpose: 1=`ACCOUNT AND NAME VERIFIED
 * SUCCESSFULLY`, 2=`ACCOUNT VERIFIED BUT NAME MISMATCH`, 3=`IFSC CODE
 * WRONG`, 4=`ACCOUNT NUMBER WRONG`, 5=`CUSTOMER BANK OFFLINE` — a closed
 * set (`bas_name` has a UNIQUE key, and the export's AUTO_INCREMENT
 * confirms exactly 5 rows exist). Legacy code
 * (`DisbursalController::verifyDisbursalBank()`, `addBeneficiary()`)
 * treats id `1` as "verified" everywhere it special-cases a value,
 * resetting sibling records to unverified when a new one is verified —
 * see `VerificationService.verifyBanking()`/`.setBankAccountStatus()`
 * (`core-api`), the full status-picker built once these real labels were
 * confirmed to exist.
 */
@Entity('master_bank_account_status')
export class BankAccountStatus {
  @PrimaryGeneratedColumn({
    name: 'bas_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'bas_name', type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @CreateDateColumn({
    name: 'bas_created_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  createdAt: Date | null;

  @UpdateDateColumn({
    name: 'bas_updated_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  updatedAt: Date | null;

  @Column({
    name: 'bas_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'bas_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
