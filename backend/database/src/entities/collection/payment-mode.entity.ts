import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_payment_mode`. `mpm_heading` is NOT NULL in legacy and mapped
 * here so rows created from this side satisfy it. Note the flags are signed
 * `tinyint` on this table, unlike most legacy lookups.
 */
@Entity('master_payment_mode')
export class PaymentMode {
  @PrimaryGeneratedColumn({ name: 'mpm_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'mpm_name', type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'mpm_heading', type: 'varchar', length: 50 })
  heading: string;

  @CreateDateColumn({
    name: 'mpm_created_on',
    type: 'datetime',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'mpm_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mpm_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
