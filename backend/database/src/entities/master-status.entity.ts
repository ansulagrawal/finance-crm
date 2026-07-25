import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from './column-transformers';

/**
 * Legacy `master_status` — the lifecycle-state lookup shared by leads,
 * collections and followups. Read by the app-server install (14 references in
 * `old-php-files/api/`).
 *
 * `status_customer_label` (the customer-facing wording the app shows) is NOT
 * NULL in legacy and mapped here so rows created from this side satisfy it.
 */
@Entity('master_status')
export class MasterStatus {
  @PrimaryGeneratedColumn({ name: 'status_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'status_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'status_stage', type: 'varchar', length: 100 })
  stageCode: string;

  @Column({ name: 'status_customer_label', type: 'varchar', length: 200 })
  customerLabel: string;

  @Column({
    name: 'status_order',
    type: 'smallint',
    unsigned: true,
    nullable: true,
  })
  sortOrder: number | null;

  @CreateDateColumn({ name: 'created_on', type: 'timestamp', precision: null })
  createdAt: Date;

  @Column({
    name: 'status_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'status_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
