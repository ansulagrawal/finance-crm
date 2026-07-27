import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { MisReportCatalog } from '../reporting/mis-report-catalog.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';

/**
 * Legacy `user_mis_permission` (confirmed against a real UAT export, 54
 * rows) — grants a specific user access to a specific MIS report.
 */
@Entity('user_mis_permission')
export class UserMisPermission {
  @PrimaryGeneratedColumn({
    name: 'mis_permission_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'mis_permission_mis_id', type: 'int', unsigned: true })
  misId: number;

  @ManyToOne(() => MisReportCatalog, { nullable: false })
  @JoinColumn({ name: 'mis_permission_mis_id' })
  mis: MisReportCatalog;

  @Column({ name: 'mis_permission_user_role_id', type: 'int', unsigned: true })
  userRoleId: number;

  @ManyToOne(() => UserRole, { nullable: true })
  @JoinColumn({ name: 'mis_permission_user_role_id' })
  userRole: UserRole | null;

  @Column({ name: 'mis_permission_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'mis_permission_user_id' })
  user: User;

  @Column({
    name: 'mis_permission_created_user_id',
    type: 'int',
    nullable: true,
  })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mis_permission_created_user_id' })
  grantedBy: User | null;

  @Column({ name: 'mis_permission_created_at', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'mis_permission_updated_user_id',
    type: 'int',
    nullable: true,
  })
  updatedById: number | null;

  @Column({
    name: 'mis_permission_updated_at',
    type: 'datetime',
    nullable: true,
  })
  updatedAt: Date | null;

  @Column({
    name: 'mis_permission_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mis_permission_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
