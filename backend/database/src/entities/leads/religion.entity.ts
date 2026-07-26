import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_religion`. Read by the app-server install (11 references in
 * `old-php-files/api/`).
 *
 * One of the four legacy tables with no primary key — the additive migration
 * adds one on `religion_id`, which is already unique and auto-increment-shaped.
 */
@Entity('master_religion')
export class Religion {
  @PrimaryGeneratedColumn({
    name: 'religion_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({
    name: 'religion_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  name: string | null;

  @CreateDateColumn({
    name: 'religion_created_at',
    type: 'timestamp',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'religion_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'religion_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
