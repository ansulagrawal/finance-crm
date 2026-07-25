import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { tinyintBoolean } from './column-transformers';

/**
 * Base for tables this rewrite creates itself — the `NEW` verdict in
 * docs/SCHEMA-MAP.md (no legacy counterpart, e.g. `refresh_tokens`,
 * `password_reset_requests`). Entities adopting a legacy table declare
 * their own PK/columns matching that table exactly instead of extending
 * this — legacy has no consistent id/timestamp/flag convention to inherit.
 *
 * Every column is explicitly typed (no relying on TypeORM's implicit
 * inference from the TS type) so check-drift.ts can compare these tables
 * against a real database exactly like every legacy-adopted entity, and so
 * behavior doesn't shift between MySQL/MariaDB. No `datetime(6)` precision —
 * the production legacy server is MariaDB 11.8.8; see additive-schema-changes.ts.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @CreateDateColumn({ type: 'datetime', precision: null })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: null })
  updatedAt: Date;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
