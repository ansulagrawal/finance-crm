import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `master_bank_type` (SAVING/CURRENT/SALARY/FIXED/RECURRING). Read by the
 * app-server install (50 references in `old-php-files/api/`); no timestamps in legacy. */
@Entity('master_bank_type')
export class BankType {
  @PrimaryGeneratedColumn({
    name: 'm_bank_type_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_bank_type_name', type: 'varchar', length: 150 })
  name: string;

  @Column({
    name: 'm_bank_type_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_bank_type_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
