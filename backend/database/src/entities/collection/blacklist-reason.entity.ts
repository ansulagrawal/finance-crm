import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `master_blacklist_reject_reason`. */
@Entity('master_blacklist_reject_reason')
export class BlacklistReason {
  @PrimaryGeneratedColumn({ name: 'm_br_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'm_br_name', type: 'varchar', length: 100 })
  name: string;

  @CreateDateColumn({
    name: 'm_br_created_on',
    type: 'datetime',
    precision: null,
    nullable: true,
  })
  createdAt: Date;

  @Column({
    name: 'm_br_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_br_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
