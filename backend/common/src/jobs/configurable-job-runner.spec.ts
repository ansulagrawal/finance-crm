import type { ConfigService } from '@nestjs/config';
import { ConfigurableJobRunner } from './configurable-job-runner';
import type { JobHandler, JobRunner } from './job-runner.interface';

describe('ConfigurableJobRunner', () => {
  let delegate: { schedule: jest.Mock };
  let configGet: jest.Mock;
  const handler: JobHandler = async () => {};

  beforeEach(() => {
    delegate = { schedule: jest.fn() };
    configGet = jest.fn().mockReturnValue(undefined);
  });

  function runner() {
    return new ConfigurableJobRunner(
      delegate as unknown as JobRunner,
      { get: configGet } as unknown as ConfigService,
    );
  }

  it('uses the hardcoded default when nothing overrides it', () => {
    runner().schedule('my-job', '0 3 * * *', handler);

    expect(delegate.schedule).toHaveBeenCalledWith(
      'my-job',
      '0 3 * * *',
      handler,
    );
  });

  it('uses the env var when set', () => {
    configGet.mockReturnValue('*/5 * * * *');

    runner().schedule('my-job', '0 3 * * *', handler);

    expect(delegate.schedule).toHaveBeenCalledWith(
      'my-job',
      '*/5 * * * *',
      handler,
    );
  });

  it('reads the env var under the CRON_<NAME> key for that job', () => {
    runner().schedule('my-job-name', '0 3 * * *', handler);

    expect(configGet).toHaveBeenCalledWith('CRON_MY_JOB_NAME');
  });

  it('does not schedule when the env var is "disabled"', () => {
    configGet.mockReturnValue('disabled');

    runner().schedule('my-job', '0 3 * * *', handler);

    expect(delegate.schedule).not.toHaveBeenCalled();
  });

  it('does not schedule when the hardcoded default is "disabled"', () => {
    runner().schedule('my-job', 'disabled', handler);

    expect(delegate.schedule).not.toHaveBeenCalled();
  });
});
