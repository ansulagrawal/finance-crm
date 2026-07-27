import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_feedback_questions`. Read by the app-server install (6
 * references in `old-php-files/api/`). Legacy caps the question at
 * `varchar(500)` rather than the `text` this entity previously declared.
 */
@Entity('master_feedback_questions')
export class FeedbackQuestion {
  @PrimaryGeneratedColumn({ name: 'mfq_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'mfq_question', type: 'varchar', length: 500 })
  question: string;

  @CreateDateColumn({
    name: 'mfq_created_on',
    type: 'datetime',
    precision: null,
  })
  createdAt: Date;

  @Column({
    name: 'mfq_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mfq_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
