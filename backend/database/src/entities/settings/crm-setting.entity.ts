import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';

/**
 * `NEW` per `docs/SCHEMA-MAP.md` — no legacy counterpart. Runtime-tunable
 * settings read by `@finance-crm/common`'s `CrmSettingsService`, layered on top of
 * (not a replacement for) the `AWS Secrets Manager -> .env` config chain —
 * see `common/src/config/aws-secrets-loader.ts` and `CLAUDE.md`'s
 * architecture-decisions entry for the full 3-stage chain. Read once at
 * each service's boot, not polled — a changed row takes effect on next
 * restart, same as changing an env var today.
 *
 * `serviceName` scopes a row to one service (`'core-api'` /
 * `'integrations-api'` / `'automation-worker'` / `'reporting-api'`) so the
 * 4 services sharing this one table can't collide on the same key;
 * `''` (empty string) is the shared/global sentinel, read by every
 * service alongside its own service-specific rows. `settingKey`/
 * `settingValue` (not `key`/`value`) sidesteps `key` being a MySQL
 * reserved word in every raw query that touches this table.
 */
@Entity('crm_settings')
@Unique(['serviceName', 'settingKey'])
export class CrmSetting extends BaseEntity {
  @Column({ type: 'varchar', length: 50, default: '' })
  serviceName: string;

  @Column({ type: 'varchar', length: 150 })
  settingKey: string;

  @Column({ type: 'text' })
  settingValue: string;
}
