import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `company_login` — the company master. It is empty in the dump and
 * referenced only twice in the legacy PHP: legacy never populated it and
 * treated `company_id` as a constant 1 everywhere (all 184 users and all 16
 * leads carry `company_id = 1`). It is still the right table to adopt, and the
 * seed inserts that implicit row explicitly.
 *
 * Every legacy column here is NOT NULL, which is why `code`/`url`/`address`/
 * `contactNumber` are no longer optional. `isActive`, `isDeleted`, `cin` and
 * `logoFileKey` have no legacy column and are added by the additive migration.
 */
@Entity('company_login')
export class Company {
  @PrimaryGeneratedColumn({
    name: 'company_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'company_name', type: 'text' })
  name: string;

  @Column({ name: 'company_code', type: 'varchar', length: 255 })
  code: string;

  @Column({ name: 'company_type', type: 'varchar', length: 255 })
  companyType: string;

  @Column({ name: 'url', type: 'text' })
  url: string;

  @Column({ name: 'address', type: 'text' })
  address: string;

  @Column({ name: 'company_contact', type: 'varchar', length: 255 })
  contactNumber: string;

  /** Added by the additive migration — no legacy column. */
  @Column({ name: 'company_cin', type: 'varchar', length: 50, nullable: true })
  cin: string | null;

  /** Storage key (not a URL) for the company logo, resolved via `StorageAdapter`
   * at render time. Added by the additive migration — no legacy column. */
  @Column({
    name: 'company_logo_file_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  logoFileKey: string | null;

  @Column({ name: 'created_by', type: 'int', unsigned: true })
  createdById: number;

  @Column({ name: 'updated_by', type: 'int' })
  updatedById: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: null })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: null })
  updatedAt: Date;

  /** Added by the additive migration — no legacy column. */
  @Column({
    name: 'company_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  /** Added by the additive migration — no legacy column. */
  @Column({
    name: 'company_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
