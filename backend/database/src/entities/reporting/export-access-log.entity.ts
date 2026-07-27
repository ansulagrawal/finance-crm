import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { User } from '../users/user.entity';
import { ExportCatalog } from './export-catalog.entity';

/**
 * Legacy `export_access_logs` — an audit row per successful CSV export
 * access (who, what, when, from where). Real legacy columns share zero
 * names with the pre-restart invented entity (no `roleCode` column; legacy
 * has `eal_user_role_id` instead). Legacy also splits the user-agent into
 * platform/browser columns; there's no UA-parsing anywhere in this codebase
 * to populate those reliably, so this keeps the full raw `userAgent` only.
 */
@Entity('export_access_logs')
export class ExportAccessLog {
  @PrimaryGeneratedColumn({ name: 'eal_id', type: 'bigint' })
  id: number;

  @Column({ name: 'eal_export_id', type: 'int', unsigned: true })
  exportId: number;

  @ManyToOne(() => ExportCatalog, { nullable: false })
  @JoinColumn({ name: 'eal_export_id' })
  export: ExportCatalog;

  @Column({ name: 'eal_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'eal_user_id' })
  user: User | null;

  @Column({
    name: 'eal_user_role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userRoleId: number | null;

  @Column({ name: 'eal_start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'eal_end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'eal_user_ip', type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({
    name: 'eal_user_platform',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  platform: string | null;

  @Column({
    name: 'eal_user_browser',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  browser: string | null;

  @Column({
    name: 'eal_user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @Column({ name: 'eal_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'eal_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'eal_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
