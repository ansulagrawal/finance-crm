import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_role_type` (23 rows).
 *
 * `code` is legacy `role_type_labels` — the `SA`/`CA`/`CR1`/`DS1`/`CO1` label
 * the legacy `LoginController::home()` switch dispatches on, and what
 * `@Roles(...)` matches against. It is NOT declared unique here: legacy has
 * only a primary key on this table, and adding a unique index to a table the
 * app-server install reads is DDL that needs their sign-off.
 */
@Entity('master_role_type')
export class RoleType {
  @PrimaryGeneratedColumn({
    name: 'role_type_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'role_type_product_id', type: 'mediumint' })
  productId: number;

  @Column({ name: 'role_type_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'role_type_heading', type: 'varchar', length: 255 })
  heading: string;

  @Column({ name: 'role_type_labels', type: 'varchar', length: 20 })
  code: string;

  @Column({
    name: 'role_type_branch_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  hasBranchScope: boolean;

  @CreateDateColumn({
    name: 'role_type_created_on',
    type: 'timestamp',
    precision: null,
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'role_type_updated_on',
    type: 'datetime',
    precision: null,
  })
  updatedAt: Date;

  @Column({
    name: 'role_type_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'role_type_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
