import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullMqJobRunner } from './bullmq-job-runner';
import { ConfigurableJobRunner } from './configurable-job-runner';
import { InProcessJobRunner } from './in-process-job-runner';
import { JOB_RUNNER } from './job-runner.tokens';

/**
 * Defaults to in-process `@nestjs/schedule` cron jobs. Auto-upgrades to
 * Redis-backed BullMQ when `REDIS_URL` is set - don't hardcode a choice in
 * a new cron job, depend on the `JOB_RUNNER` token instead.
 *
 * Whichever concrete runner is selected is wrapped in
 * `ConfigurableJobRunner`, which makes every job's cron timing (and
 * whether it runs at all) overridable via a `CRON_<NAME>` env var — see
 * that file's doc comment. No changes needed to individual job files to
 * get this.
 *
 * Cron timing is deliberately NOT read from the `crm_settings` DB table
 * (2026-08-07, client instruction) — this module briefly bulk-loaded that
 * table here and was its only consumer. Env var, or the job's hardcoded
 * default, and nothing else.
 */
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    InProcessJobRunner,
    {
      provide: JOB_RUNNER,
      inject: [ConfigService, InProcessJobRunner],
      useFactory: (config: ConfigService, inProcess: InProcessJobRunner) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const delegate = redisUrl ? new BullMqJobRunner(redisUrl) : inProcess;
        return new ConfigurableJobRunner(delegate, config);
      },
    },
  ],
  exports: [JOB_RUNNER],
})
export class JobRunnerModule {}
