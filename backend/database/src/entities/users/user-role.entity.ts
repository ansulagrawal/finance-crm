import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Product } from '../company/product.entity';
import { RoleType } from './role-type.entity';
import { User } from './user.entity';

/** 0=Both, 1=New, 2=Repeat — legacy `user_roles.user_type` comment. */
export enum UserRoleUserType {
  BOTH = 0,
  NEW = 1,
  REPEAT = 2,
}

/**
 * 0=>No Allocation Required, 1=>Lead-New, 3=>Lead-Hold, 4=>Application-New,
 * 6=>Application-Hold — legacy `user_roles.lead_allocation_type` comment
 * (2 and 5 are not used by legacy).
 */
export enum UserRoleLeadAllocationType {
  NONE = 0,
  LEAD_NEW = 1,
  LEAD_HOLD = 3,
  APPLICATION_NEW = 4,
  APPLICATION_HOLD = 6,
}

/** Legacy `user_roles` (confirmed against a real UAT export). */
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn({
    name: 'user_role_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'user_role_type_id', type: 'mediumint', unsigned: true })
  roleTypeId: number;

  @ManyToOne(() => RoleType, { nullable: false })
  @JoinColumn({ name: 'user_role_type_id' })
  roleType: RoleType;

  @Column({ name: 'user_role_user_id', type: 'bigint', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_role_user_id' })
  user: User;

  @Column({
    name: 'user_role_product_id',
    type: 'mediumint',
    unsigned: true,
    default: 1,
  })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'user_role_product_id' })
  product: Product;

  @Column({
    name: 'user_role_supervisor_role_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  supervisorRoleId: number | null;

  @ManyToOne(() => UserRole, { nullable: true })
  @JoinColumn({ name: 'user_role_supervisor_role_id' })
  supervisorRole: UserRole | null;

  /** `L1`/`L2`/`L3`/`L4` — a string code, not a numeric level. */
  @Column({
    name: 'user_role_level',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  level: string | null;

  @Column({
    name: 'user_type',
    type: 'tinyint',
    nullable: true,
    default: UserRoleUserType.BOTH,
  })
  userType: UserRoleUserType;

  @Column({
    name: 'lead_allocation_type',
    type: 'tinyint',
    nullable: true,
    default: UserRoleLeadAllocationType.NONE,
  })
  leadAllocationType: UserRoleLeadAllocationType;

  @Column({
    name: 'user_role_created_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @Column({ name: 'user_role_created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'user_role_updated_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  updatedById: number | null;

  @Column({ name: 'user_role_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'user_role_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'user_role_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  @Column({
    name: 'user_role_export_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  hasExportAccess: boolean;
}
