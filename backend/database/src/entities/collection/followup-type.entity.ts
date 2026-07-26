import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_followup_type`. `m_followup_type_heading` is NOT NULL in
 * legacy and mapped here so rows created from this side satisfy it.
 */
@Entity('master_followup_type')
export class FollowupType {
  @PrimaryGeneratedColumn({
    name: 'm_followup_type_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_followup_type_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'm_followup_type_heading', type: 'varchar', length: 100 })
  heading: string;

  @Column({
    name: 'm_followup_type_icons',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  icon: string | null;

  @CreateDateColumn({
    name: 'm_followup_type_created_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  createdAt: Date;

  @Column({
    name: 'm_followup_type_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_followup_type_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
