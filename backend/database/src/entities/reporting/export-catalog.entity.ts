import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_export` — the catalog of CSV exports that
 * `UserExportPermission.exportId` grants access against. `isLive` mirrors
 * `m_export_is_live`, the separate "actually reachable in the UI" flag legacy
 * always checked alongside active/deleted (`Export_Model.php`/`UMS_Model.php`).
 *
 * Adopting the legacy table also settles the id-parity concern this entity used
 * to carry: every `@RequireExportPermission(id)` decorator in `reporting-api`
 * hardcodes a legacy `m_export_id`, and those are now the actual primary keys
 * rather than ids a seed had to reproduce.
 */
@Entity('master_export')
export class ExportCatalog {
  @PrimaryGeneratedColumn({ name: 'm_export_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'm_export_name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'm_export_heading', type: 'varchar', length: 150 })
  heading: string;

  @Column({
    name: 'm_export_is_live',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isLive: boolean;

  @CreateDateColumn({
    name: 'm_export_created_at',
    type: 'datetime',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'm_export_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_export_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
