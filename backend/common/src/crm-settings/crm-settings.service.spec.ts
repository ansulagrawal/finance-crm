import type { CrmSetting } from '@finance-crm/database';
import type { Repository } from 'typeorm';
import { CrmSettingsService } from './crm-settings.service';

describe('CrmSettingsService', () => {
  let service: CrmSettingsService;
  let repository: { find: jest.Mock };

  beforeEach(() => {
    repository = { find: jest.fn() };
    service = new CrmSettingsService(
      repository as unknown as Repository<CrmSetting>,
    );
  });

  describe('get', () => {
    it('returns the service-specific value when both rows exist', async () => {
      repository.find.mockResolvedValue([
        { serviceName: '', settingKey: 'FOO', settingValue: 'shared' },
        {
          serviceName: 'automation-worker',
          settingKey: 'FOO',
          settingValue: 'specific',
        },
      ]);

      const value = await service.get('automation-worker', 'FOO');

      expect(value).toBe('specific');
    });

    it('falls back to the shared value when no service-specific row exists', async () => {
      repository.find.mockResolvedValue([
        { serviceName: '', settingKey: 'FOO', settingValue: 'shared' },
      ]);

      const value = await service.get('automation-worker', 'FOO');

      expect(value).toBe('shared');
    });

    it('returns undefined when no row exists', async () => {
      repository.find.mockResolvedValue([]);

      const value = await service.get('automation-worker', 'FOO');

      expect(value).toBeUndefined();
    });
  });

  describe('getAllForService', () => {
    it('merges shared and service-specific rows, service-specific wins on key clash', async () => {
      repository.find.mockResolvedValue([
        { serviceName: '', settingKey: 'FOO', settingValue: 'shared-foo' },
        { serviceName: '', settingKey: 'BAR', settingValue: 'shared-bar' },
        {
          serviceName: 'automation-worker',
          settingKey: 'FOO',
          settingValue: 'specific-foo',
        },
      ]);

      const result = await service.getAllForService('automation-worker');

      expect(result.get('FOO')).toBe('specific-foo');
      expect(result.get('BAR')).toBe('shared-bar');
      expect(result.size).toBe(2);
    });
  });
});
