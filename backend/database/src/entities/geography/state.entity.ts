import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_state`. Read by the customer-facing app-server install
 * (28 references in `old-php-files/api/`) — additive changes only.
 *
 * Legacy has no created/updated timestamps on this table, so neither does this
 * entity. `cibil_state_code` is left unmapped.
 */
@Entity('master_state')
export class State {
  @PrimaryGeneratedColumn({
    name: 'm_state_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'm_state_name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'm_state_code', type: 'varchar', length: 20, nullable: true })
  code: string | null;

  /** Whether this state is an active lending-sourcing area, used by BRE's
   * geo-eligibility rule. */
  @Column({
    name: 'm_state_is_sourcing',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isSourcing: boolean;

  @Column({
    name: 'm_state_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_state_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
