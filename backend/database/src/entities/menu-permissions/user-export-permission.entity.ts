import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExportCatalog } from '../reporting/export-catalog.entity';
import { tinyintBoolean } from '../column-transformers';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';

/**
 * Legacy `user_export_permission` (confirmed against a real UAT export, 43
 * rows) — grants a specific user access to a specific CSV export.
 */
@Entity('user_export_permission')
export class UserExportPermission {
  @PrimaryGeneratedColumn({
    name: 'export_permission_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'export_permission_export_id', type: 'int', unsigned: true })
  exportId: number;

  @ManyToOne(() => ExportCatalog, { nullable: false })
  @JoinColumn({ name: 'export_permission_export_id' })
  export: ExportCatalog;

  @Column({
    name: 'export_permission_user_role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userRoleId: number | null;

  @ManyToOne(() => UserRole, { nullable: true })
  @JoinColumn({ name: 'export_permission_user_role_id' })
  userRole: UserRole | null;

  @Column({ name: 'export_permission_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'export_permission_user_id' })
  user: User;

  @Column({
    name: 'export_permission_created_user_id',
    type: 'int',
    nullable: true,
  })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'export_permission_created_user_id' })
  grantedBy: User | null;

  @Column({ name: 'export_permission_created_at', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'export_permission_updated_user_id',
    type: 'int',
    nullable: true,
  })
  updatedById: number | null;

  @Column({
    name: 'export_permission_updated_at',
    type: 'datetime',
    nullable: true,
  })
  updatedAt: Date | null;

  @Column({
    name: 'export_permission_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'export_permission_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
