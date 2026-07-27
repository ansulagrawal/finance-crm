import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_mis_report` — the catalog of MIS reports that
 * `UserMisPermission.misId` grants access against. Same shape and same
 * id-parity rationale as `ExportCatalog` (see its doc comment): every
 * `@RequireMisPermission(id)` decorator in `reporting-api` hardcodes a legacy
 * `m_report_id`, which is now the actual primary key.
 */
@Entity('master_mis_report')
export class MisReportCatalog {
  @PrimaryGeneratedColumn({ name: 'm_report_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'm_report_name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'm_report_heading', type: 'varchar', length: 150 })
  heading: string;

  @Column({
    name: 'm_report_is_live',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isLive: boolean;

  @CreateDateColumn({
    name: 'm_report_created_at',
    type: 'datetime',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'm_report_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_report_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
