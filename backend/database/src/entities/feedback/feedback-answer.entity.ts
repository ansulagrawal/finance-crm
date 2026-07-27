import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_feedback_answers`. Read by the app-server install (6
 * references in `old-php-files/api/`). `mfa_icons` is NOT NULL in legacy and
 * mapped here so rows created from this side satisfy it.
 */
@Entity('master_feedback_answers')
export class FeedbackAnswer {
  @PrimaryGeneratedColumn({ name: 'mfa_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'mfa_answer', type: 'varchar', length: 20 })
  answer: string;

  @Column({ name: 'mfa_icons', type: 'varchar', length: 200 })
  icon: string;

  @CreateDateColumn({
    name: 'mfa_created_on',
    type: 'datetime',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'mfa_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mfa_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
