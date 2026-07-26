import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * `ADOPT-UNVERIFIED` per docs/SCHEMA-MAP.md — legacy `master_collection_bucket_wise`
 * (a named DPD/days-past-due range, e.g. "0-30 DPD") is absent from the UAT
 * dump, but its real columns are known from
 * `old-php-files/application/models/UMS/UMS_Model.php`
 * (`mcbw_id`/`mcbw_name`/`mcbw_start`/`mcbw_end`/`mcbw_active`/`mcbw_deleted`).
 * Confirm against production before cutover; create this table only if
 * production also lacks it. Not seeded with real bucket rows — the actual
 * business ranges need to come from the client.
 */
@Entity('master_collection_bucket_wise')
export class CollectionBucket {
  @PrimaryGeneratedColumn({ name: 'mcbw_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'mcbw_name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'mcbw_start', type: 'int' })
  startDpd: number;

  @Column({ name: 'mcbw_end', type: 'int' })
  endDpd: number;

  @Column({
    name: 'mcbw_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mcbw_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
