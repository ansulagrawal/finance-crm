import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Company } from '../company/company.entity';
import { Product } from '../company/product.entity';

/**
 * Legacy `tbl_rejection_master` (67 rows).
 *
 * `isActive` maps onto legacy's `status` int rather than an `*_active` flag —
 * this table predates the `master_*` convention. There is no deleted column at
 * all, so `is_deleted` is added by the additive migration.
 */
@Entity('tbl_rejection_master')
export class RejectionReason {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'reason', type: 'varchar', length: 255 })
  reason: string;

  /** Legacy `user_access`, NOT NULL — which role tier may pick this reason. */
  @Column({
    name: 'user_access',
    type: 'enum',
    enum: ['0', '1', '2', '3', '4'],
  })
  userAccess: string;

  @Column({
    name: 'sms_sent_flag',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  notifyBySms: boolean;

  @Column({
    name: 'email_sent_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  notifyByEmail: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: null })
  createdAt: Date;

  @Column({
    name: 'status',
    type: 'int',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  /** Added by the additive migration — legacy has no deleted flag here. */
  @Column({
    name: 'is_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
