import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { JobHandler, JobRunner } from './job-runner.interface';

@Injectable()
export class InProcessJobRunner implements JobRunner {
  private readonly logger = new Logger(InProcessJobRunner.name);
  private readonly running = new Set<string>();

  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  schedule(name: string, cronExpression: string, handler: JobHandler): void {
    const job = new CronJob(cronExpression, () => this.run(name, handler));
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
    this.logger.log(`Scheduled job "${name}" (${cronExpression}, in-process)`);
  }

  private async run(name: string, handler: JobHandler): Promise<void> {
    if (this.running.has(name)) {
      this.logger.warn(`Skipping "${name}" - previous run still in progress`);
      return;
    }
    this.running.add(name);
    try {
      await handler();
    } catch (error) {
      this.logger.error(`Job "${name}" failed`, error as Error);
    } finally {
      this.running.delete(name);
    }
  }
}
