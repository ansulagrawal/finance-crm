import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { BreCategory } from './bre-category.entity';

/** Legacy `master_bre_rule`. */
@Entity('master_bre_rule')
export class BreRule {
  @PrimaryGeneratedColumn({
    name: 'm_bre_rule_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_bre_rule_catgory_id', type: 'int', unsigned: true })
  categoryId: number;

  @ManyToOne(() => BreCategory, { nullable: false })
  @JoinColumn({ name: 'm_bre_rule_catgory_id' })
  category: BreCategory;

  @Column({ name: 'm_bre_rule_name', type: 'varchar', length: 200 })
  name: string;

  @Column({
    name: 'm_bre_rule_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  description: string | null;

  @Column({ name: 'm_bre_rule_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'm_bre_rule_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_bre_rule_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
