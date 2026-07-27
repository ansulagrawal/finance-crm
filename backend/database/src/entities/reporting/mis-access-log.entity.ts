import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { User } from '../users/user.entity';
import { MisReportCatalog } from './mis-report-catalog.entity';

/**
 * Legacy `mis_access_logs` — same shape and rationale as `ExportAccessLog`
 * (see its doc comment), one row per successful MIS report access.
 */
@Entity('mis_access_logs')
export class MisAccessLog {
  @PrimaryGeneratedColumn({ name: 'mal_id', type: 'bigint' })
  id: number;

  @Column({ name: 'mal_mis_id', type: 'int', unsigned: true })
  misId: number;

  @ManyToOne(() => MisReportCatalog, { nullable: false })
  @JoinColumn({ name: 'mal_mis_id' })
  mis: MisReportCatalog;

  @Column({ name: 'mal_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mal_user_id' })
  user: User | null;

  @Column({
    name: 'mal_user_role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userRoleId: number | null;

  @Column({ name: 'mal_start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'mal_end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'mal_user_ip', type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({
    name: 'mal_user_platform',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  platform: string | null;

  @Column({
    name: 'mal_user_browser',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  browser: string | null;

  @Column({
    name: 'mal_user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @Column({ name: 'mal_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'mal_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mal_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
