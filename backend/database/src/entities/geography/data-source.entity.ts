import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_data_source` (35 rows). Read by the customer-facing
 * app-server install (21 references in `old-php-files/api/`) — additive
 * changes only. Legacy has no created/updated timestamps here.
 */
@Entity('master_data_source')
export class DataSource {
  @PrimaryGeneratedColumn({
    name: 'data_source_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'data_source_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'data_source_code', type: 'varchar', length: 10 })
  code: string;

  @Column({
    name: 'data_source_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'data_source_deleted',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
