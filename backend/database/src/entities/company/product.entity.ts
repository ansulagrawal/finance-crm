import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Company } from './company.entity';

/**
 * Legacy `tbl_product`. Read by the app-server install.
 *
 * `company_id` is `mediumint unsigned` here while `company_login.company_id` is
 * `bigint unsigned`, so the join column is declared explicitly rather than
 * inherited from the referenced primary key. Legacy has no foreign keys, so the
 * width difference is only a mapping concern, not a data one.
 *
 * Every legacy column is NOT NULL; `isActive`/`isDeleted` have no legacy column
 * and are added by the additive migration.
 */
@Entity('tbl_product')
export class Product {
  @PrimaryGeneratedColumn({
    name: 'product_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'company_id', type: 'mediumint', unsigned: true })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'product_code', type: 'varchar', length: 255 })
  code: string;

  @Column({ name: 'product_type', type: 'varchar', length: 255 })
  productType: string;

  @Column({ name: 'source', type: 'varchar', length: 50 })
  source: string;

  @Column({ name: 'created_by', type: 'varchar', length: 255 })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 255 })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: null })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: null })
  updatedAt: Date;

  /** Added by the additive migration — no legacy column. */
  @Column({
    name: 'product_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  /** Added by the additive migration — no legacy column. */
  @Column({
    name: 'product_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
