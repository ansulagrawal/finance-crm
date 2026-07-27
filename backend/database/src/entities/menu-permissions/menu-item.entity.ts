import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../company/company.entity';
import { Product } from '../company/product.entity';
import { tinyintBoolean } from '../column-transformers';
import { RoleType } from '../users/role-type.entity';

/**
 * Legacy `master_lms_menu` (confirmed against a real UAT export, 82 rows) —
 * a FLAT list, not a self-referencing tree: there is no parent/child column.
 * Grouping happens via `sectionId` (legacy `role_id`, an arbitrary numeric
 * grouping key with no lookup table) plus `sectionLabel` (legacy `role`).
 * Per-item visibility is gated by `roleType`, joined on `user_labels` — the
 * same code as `RoleType.code`, not `RoleType.id`. `stage` free-strings the
 * workflow stage this item's list view queries (usually matches
 * `MasterStatus.stageCode`, e.g. "S31", but a few legacy rows have
 * inconsistent values like "1" for support tickets).
 *
 * Legacy has no `is_deleted` column here, unlike most other master_* tables.
 */
@Entity('master_lms_menu')
export class MenuItem {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'company_id', type: 'int', unsigned: true })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'product_id', type: 'int', unsigned: true })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'user_labels', type: 'varchar', length: 100 })
  roleTypeCode: string;

  @ManyToOne(() => RoleType, { nullable: false })
  @JoinColumn({ name: 'user_labels', referencedColumnName: 'code' })
  roleType: RoleType;

  @Column({ name: 'role_id', type: 'int' })
  sectionId: number;

  @Column({ name: 'role', type: 'varchar', length: 100 })
  sectionLabel: string;

  @Column({ name: 'menu_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'stage', type: 'varchar', length: 45 })
  stage: string;

  @Column({ name: 'route_link', type: 'varchar', length: 255 })
  routeLink: string;

  @Column({ name: 'menu_config', type: 'varchar', length: 255, nullable: true })
  config: string | null;

  @Column({ name: 'menu_order', type: 'int', nullable: true })
  sortOrder: number | null;

  @Column({ name: 'icon', type: 'varchar', length: 255, nullable: true })
  icon: string | null;

  @Column({ name: 'box_bg_color', type: 'varchar', length: 20 })
  boxBgColor: string;

  @Column({
    name: 'is_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'int', unsigned: true })
  createdById: number;

  @Column({ name: 'created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_by', type: 'int', unsigned: true })
  updatedById: number;

  @Column({ name: 'updated_on', type: 'datetime' })
  updatedAt: Date;
}
