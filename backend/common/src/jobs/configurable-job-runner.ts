import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JobHandler, JobRunner } from './job-runner.interface';

/**
 * Wraps any `JobRunner` to make every job's timing configurable via
 * environment variables — no changes needed to individual job files.
 *
 * For a job named `screener-lead-allocation-g50k`, the override env var is
 * `CRON_SCREENER_LEAD_ALLOCATION_G50K` (kebab-case name, upper-cased,
 * dashes to underscores):
 * - The `CRON_<NAME>` env var is used if set.
 * - Otherwise, the job's hardcoded default `cronExpression` is used (fully
 *   backward compatible).
 * - Either source resolving to `disabled` (case-insensitive): the job is
 *   not scheduled at all.
 *
 * Cron timing is deliberately **not** read from the `crm_settings` DB table
 * (2026-08-07, client instruction). It briefly was, as that table's only
 * consumer; env var + hardcoded default is the whole story now.
 *
 * `disabled` (case-insensitive) is also honored as the job's own hardcoded
 * default `cronExpression` — not just as an override. This is how jobs
 * confirmed absent from the real production crontab stay built and tested
 * but off by default everywhere, while remaining one override (DB row or
 * `CRON_<NAME>=<expr>` env var) away from being turned on in a different
 * environment without a redeploy.
 */
export class ConfigurableJobRunner implements JobRunner {
  private readonly logger = new Logger(ConfigurableJobRunner.name);

  constructor(
    private readonly delegate: JobRunner,
    private readonly configService: ConfigService,
  ) {}

  schedule(name: string, cronExpression: string, handler: JobHandler): void {
    const key = ConfigurableJobRunner.envKeyFor(name);
    const override = this.configService.get<string>(key);
    const resolvedExpression = override?.trim() || cronExpression;

    if (resolvedExpression.toLowerCase() === 'disabled') {
      this.logger.log(
        `Job "${name}" disabled ${override ? `via ${key}` : 'by default'}`,
      );
      return;
    }

    if (override) {
      this.logger.log(
        `Job "${name}" cron overridden via ${key}: "${resolvedExpression}"`,
      );
    }
    this.delegate.schedule(name, resolvedExpression, handler);
  }

  static envKeyFor(name: string): string {
    return `CRON_${name.toUpperCase().replace(/-/g, '_')}`;
  }
}
