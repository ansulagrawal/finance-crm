export type JobHandler = () => Promise<void>;

export interface JobRunner {
  /**
   * Register a recurring job. `cronExpression` is a standard 5/6-field cron
   * string (e.g. every two hours: "0 0,2,4,6,8,10,12,14,16,18,20,22 * * *").
   * Implementations must not run overlapping invocations of the same named
   * job concurrently.
   */
  schedule(name: string, cronExpression: string, handler: JobHandler): void;
}
