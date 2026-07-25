import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { Company } from '../company/company.entity';
import { Product } from '../company/product.entity';

/**
 * Legacy `users` (184 rows).
 *
 * Two legacy realities shape this mapping:
 *
 * - **`users.password` holds MD5, not bcrypt** (every stored value is exactly
 *   32 characters). This backend never reads it: `passwordHash` maps to a new
 *   `user_password_hash` column added by the additive migration, which is null
 *   for every migrated user, and they set a password through the reset flow
 *   before their first sign-in. `legacyPasswordMd5` stays mapped only because
 *   the legacy column is NOT NULL and inserts have to satisfy it — and leaving
 *   it untouched keeps the legacy PHP login working during cutover.
 * - **`email` has no unique index** — legacy declares only a primary key on
 *   this table. Adding one is DDL against a shared table and would fail on any
 *   existing duplicate, so uniqueness is not declared here.
 *
 * `name` is the display name (`users.name`) and `username` is the login handle
 * (`users.user_name`, null for most rows) — legacy has both.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'email', type: 'varchar', length: 100 })
  email: string;

  /** Legacy stores this as `bigint unsigned`; every DTO treats it as a string. */
  @Column({
    name: 'mobile',
    type: 'bigint',
    unsigned: true,
    transformer: numericString,
  })
  mobile: string;

  @Column({ name: 'user_name', type: 'varchar', length: 50, nullable: true })
  username: string | null;

  /** Never serialized into an API response — `ClassSerializerInterceptor`
   * (registered globally in every service's `main.ts`) strips this via
   * `@Exclude()` on the way out, regardless of how deeply nested this entity is
   * in a response. Internal repository reads/writes are unaffected.
   *
   * Added by the additive migration; legacy `password` is MD5 (see
   * `legacyPasswordMd5`). */
  @Exclude()
  @Column({
    name: 'user_password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  /** Legacy `users.password` — an MD5 digest, NOT NULL. Mapped only so rows
   * created from this side satisfy the constraint; never read for
   * authentication and never written with a bcrypt hash. */
  @Exclude()
  @Column({ name: 'password', type: 'varchar', length: 255 })
  legacyPasswordMd5: string;

  @Column({
    name: 'user_last_login_datetime',
    type: 'datetime',
    nullable: true,
  })
  lastLoginAt: Date | null;

  @Column({
    name: 'user_last_login_ip',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  lastLoginIp: string | null;

  @Column({
    name: 'user_logins_failed_count',
    type: 'tinyint',
    nullable: true,
    default: 0,
  })
  failedLoginCount: number;

  @Column({
    name: 'user_last_password_reset_datetime',
    type: 'datetime',
    nullable: true,
  })
  lastPasswordResetAt: Date | null;

  @Column({ name: 'company_id', type: 'mediumint', unsigned: true })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_id', type: 'mediumint', unsigned: true })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @CreateDateColumn({
    name: 'created_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  updatedAt: Date;

  @Column({
    name: 'user_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'user_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /** Stored lowercase always — `email` is the login identity. Runs on every
   * `save()` regardless of caller (API DTOs, seed scripts), so nothing can
   * bypass it. Legacy rows are uppercase; the existing lowercasing migration
   * still applies. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase();
  }
}
