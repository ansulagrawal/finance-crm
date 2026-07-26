import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `master_bre_category`. No timestamps in legacy. */
@Entity('master_bre_category')
export class BreCategory {
  @PrimaryGeneratedColumn({
    name: 'm_bre_cat_id',
    type: 'int',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_bre_cat_name', type: 'varchar', length: 200 })
  name: string;

  @Column({
    name: 'm_bre_cat_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_bre_cat_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
