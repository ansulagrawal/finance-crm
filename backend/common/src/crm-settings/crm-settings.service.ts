import { CrmSetting } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Reads runtime-tunable settings from the shared `crm_settings` table -
 * layered on top of (not a replacement for) the AWS Secrets Manager -> .env
 * config chain, see CLAUDE.md's architecture-decisions entry. Restart-only:
 * callers read once at boot (e.g. `JOB_RUNNER`'s factory provider), there is
 * no polling or live-reload.
 *
 * A row with `serviceName: ''` is a shared/global default every service
 * sees; a row with `serviceName` matching the caller overrides it for that
 * service only.
 */
@Injectable()
export class CrmSettingsService {
  constructor(
    @InjectRepository(CrmSetting)
    private readonly repository: Repository<CrmSetting>,
  ) {}

  async get(serviceName: string, key: string): Promise<string | undefined> {
    const rows = await this.repository.find({
      where: [
        { serviceName, settingKey: key, isActive: true, isDeleted: false },
        { serviceName: '', settingKey: key, isActive: true, isDeleted: false },
      ],
    });
    const specific = rows.find((row) => row.serviceName === serviceName);
    return (specific ?? rows.find((row) => row.serviceName === ''))
      ?.settingValue;
  }

  /**
   * All settings visible to `serviceName`: global (`''`) rows plus that
   * service's own rows, with service-specific values winning on key clashes.
   */
  async getAllForService(serviceName: string): Promise<Map<string, string>> {
    const rows = await this.repository.find({
      where: [
        { serviceName, isActive: true, isDeleted: false },
        { serviceName: '', isActive: true, isDeleted: false },
      ],
    });

    const result = new Map<string, string>();
    for (const row of rows.filter((row) => row.serviceName === '')) {
      result.set(row.settingKey, row.settingValue);
    }
    for (const row of rows.filter((row) => row.serviceName === serviceName)) {
      result.set(row.settingKey, row.settingValue);
    }
    return result;
  }
}
