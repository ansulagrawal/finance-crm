import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { State } from './state.entity';

/**
 * Legacy `master_city`. Read by the customer-facing app-server install
 * (63 references in `old-php-files/api/`) — additive changes only.
 *
 * Legacy has no created/updated timestamps here. `m_city_code`,
 * `m_city_branch_id` and `m_city_trial_sourcing` are left unmapped.
 */
@Entity('master_city')
export class City {
  @PrimaryGeneratedColumn({ name: 'm_city_id', type: 'int', unsigned: true })
  id: number;

  @ManyToOne(() => State, { nullable: false })
  @JoinColumn({ name: 'm_city_state_id' })
  state: State;

  @Column({ name: 'm_city_name', type: 'varchar', length: 150 })
  name: string;

  /** `'A'`/`'B'` city band, used by BRE's FOIR-percentage lookup and
   * geo-eligibility rules. Null for the legacy rows with no category set. */
  @Column({ name: 'm_city_category', type: 'char', length: 1, nullable: true })
  category: string | null;

  /** Whether this city is an active lending-sourcing area. Legacy's separate
   * `m_city_trial_sourcing` flag is not ported. */
  @Column({
    name: 'm_city_is_sourcing',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isSourcing: boolean;

  @Column({
    name: 'm_city_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_city_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
