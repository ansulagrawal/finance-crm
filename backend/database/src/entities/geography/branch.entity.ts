import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_branch`. Read by the customer-facing app-server install
 * (14 references in `old-php-files/api/`) — additive changes only.
 * Legacy has no created/updated timestamps here.
 */
@Entity('master_branch')
export class Branch {
  @PrimaryGeneratedColumn({
    name: 'm_branch_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_branch_name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'm_branch_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_branch_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
