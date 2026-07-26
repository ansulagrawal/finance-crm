import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `master_marital_status`. Read by the app-server install; no timestamps in legacy. */
@Entity('master_marital_status')
export class MaritalStatus {
  @PrimaryGeneratedColumn({
    name: 'm_marital_status_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_marital_status_name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'm_marital_status_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_marital_status_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
