import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { JobHandler, JobRunner } from './job-runner.interface';

/**
 * Redis-backed job runner (BullMQ) - used instead of `InProcessJobRunner`
 * when `REDIS_URL` is configured. Gives retries, concurrency control, and
 * lets `automation-worker` run as more than one replica without duplicate
 * job execution (BullMQ's repeatable jobs are deduplicated by the queue).
 */
@Injectable()
export class BullMqJobRunner implements JobRunner, OnModuleDestroy {
  private readonly logger = new Logger(BullMqJobRunner.name);
  private readonly connection: IORedis;
  private readonly queues: Queue[] = [];
  private readonly workers: Worker[] = [];

  constructor(redisUrl: string) {
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  schedule(name: string, cronExpression: string, handler: JobHandler): void {
    const queue = new Queue(name, { connection: this.connection });
    const worker = new Worker(
      name,
      async () => {
        await handler();
      },
      { connection: this.connection, concurrency: 1 },
    );
    worker.on('failed', (_job, error) => {
      this.logger.error(`Job "${name}" failed`, error);
    });
    queue
      .add(
        name,
        {},
        {
          repeat: { pattern: cronExpression },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
      .catch((error) => {
        this.logger.error(`Failed to schedule "${name}"`, error as Error);
      });
    this.queues.push(queue);
    this.workers.push(worker);
    this.logger.log(`Scheduled job "${name}" (${cronExpression}, bullmq)`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(this.queues.map((queue) => queue.close()));
    this.connection.disconnect();
  }
}
