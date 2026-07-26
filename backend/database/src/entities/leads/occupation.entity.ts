import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `master_occupation`. Read by the app-server install; no timestamps in legacy. */
@Entity('master_occupation')
export class Occupation {
  @PrimaryGeneratedColumn({
    name: 'm_occupation_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_occupation_name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'm_occupation_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_occupation_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
