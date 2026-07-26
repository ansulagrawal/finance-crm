import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_followup_status`. `m_followup_status_heading` is NOT NULL in
 * legacy and mapped here so rows created from this side satisfy it.
 */
@Entity('master_followup_status')
export class FollowupStatus {
  @PrimaryGeneratedColumn({
    name: 'm_followup_status_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_followup_status_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'm_followup_status_heading', type: 'varchar', length: 100 })
  heading: string;

  @CreateDateColumn({
    name: 'm_followup_status_created_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  createdAt: Date;

  @Column({
    name: 'm_followup_status_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_followup_status_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
