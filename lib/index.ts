/**
 * The log level.
 */
enum LogLevel {
  ERROR = 'error',
  INFO = 'info',
  DEBUG = 'debug',
}

type AsyncSequenceError = {
  message: string;
  stack: string;
};

type AsyncSequenceResult<T> = T;

/**
 * A logger interface.
 * Implement this interface to provide your own logger.
 */
interface Logger {
  /**
   * Logs a message at the given level.
   */
  log: (level: LogLevel, message: string) => void;
}

/**
 * Options for the PromiseSequencer.
 */
interface PromiseSequencerOptions<T> {
  /**
   * Returns a generator that yields promises.
   */
  promiseGenerator: Generator<() => Promise<T>, void, unknown>;
  /**
   * The number of promises to run concurrently.
   * @default 1
   */
  concurrency?: number;
  /**
   * The number of times to retry a failed task.
   * @default 0
   */
  retryAttempts?: number;
  /**
   * The delay in milliseconds between retries.
   * @default 0
   */
  retryDelay?: number;
  /**
   * A logger to use for logging.
   * @default console
   */
  logger?: Logger;
  /**
   * Whether to disable logging.
   * @default false
   * */
  disableLogs?: boolean;
  /**
   * A callback that is called when a task is completed.
   */
  onTaskCompleted?: (result: () => AsyncSequenceResult<T>) => void;
  /**
   * A callback that is called when a task fails.
   * */
  onTaskFailed?: (error: () => AsyncSequenceError) => void;
  /**
   * A callback that is called when a task is retried.
   * */
  onTaskRetried?: (task: () => Promise<T>) => void;
  /**
   * Chose if you want the failed tasks to throw and error or or return null.
   */
  throwOnError?: boolean;
}

/**
 * A PromiseSequencer is a utility class that allows you to run a sequence of promises
 * with a given concurrency. It also allows you to retry failed tasks.
 */
class PromiseSequencer<T> {
  private promiseGenerator: Generator<() => Promise<T>, void, unknown>;
  private isRunning = false;
  private concurrency: number;
  private retryAttempts: number;
  private retryDelay: number;
  private logger: Logger;
  private disableLogs: boolean;
  private queue: (() => Promise<T>)[];
  private runningTasks: (() => Promise<T>)[];
  private completedTasks: (() => Promise<T>)[];
  private failedTasks: (() => Promise<T>)[];
  private retryTasks: (() => Promise<T>)[];
  private results: (T | null)[] = [];
  private throwOnError: boolean;
  private onTaskCompleted?: (result: () => AsyncSequenceResult<T>) => void;
  private onTaskFailed?: (error: () => AsyncSequenceError) => void;
  private onTaskRetried?: (task: () => Promise<T>) => void;

  /**
   * Creates a new PromiseSequencer.
   */
  constructor(options: PromiseSequencerOptions<T>) {
    this.promiseGenerator = options.promiseGenerator;
    this.concurrency = options.concurrency || 1;
    this.retryAttempts = options.retryAttempts || 0;
    this.retryDelay = options.retryDelay || 0;
    this.logger = this.adaptedLogger(options.logger);
    this.disableLogs = options.disableLogs || false;
    this.queue = [];
    this.runningTasks = [];
    this.completedTasks = [];
    this.failedTasks = [];
    this.retryTasks = [];
    this.onTaskCompleted = options.onTaskCompleted;
    this.onTaskFailed = options.onTaskFailed;
    this.onTaskRetried = options.onTaskRetried;
    this.throwOnError = options.throwOnError || false;
  }

  private defaultLogger(): Logger {
    return {
      log: (level, message) => {
        if (!this.disableLogs) {
          console.log(`[${level.toUpperCase()}] ${message}`);
        }
      },
    };
  }

  private adaptedLogger(logger?: Logger): Logger {
    if (!logger) return this.defaultLogger();
    return {
      log: (level, message) => {
        if (!this.disableLogs) {
          logger.log(level, message);
        }
      },
    };
  }

  private async runTaskWithRetry(task: () => Promise<T>): Promise<void> {
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await task();
        if (this.onTaskCompleted) {
          this.onTaskCompleted(() => result);
        }
        this.results.push(result);
        return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        this.logger.log(LogLevel.ERROR, `Error occurred: ${error.message}`);
        if (attempt < this.retryAttempts) {
          this.logger.log(LogLevel.INFO, `Retrying after ${this.retryDelay}ms...`);
          if (this.onTaskRetried) {
            this.onTaskRetried(task);
          }
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        } else {
          if (this.throwOnError) {
            if (this.onTaskFailed) {
              this.onTaskFailed(() => error);
            }
            throw error;
          } else {
            this.results.push(null);
            return;
          }
        }
      }
    }
  }

  private runNextTask() {
    if (!this.isRunning) {
      return;
    }
    const nextTask = this.promiseGenerator.next();
    if (nextTask.done) {
      if (this.runningTasks.length === 0) {
        this.logger.log(LogLevel.INFO, 'Promise sequencer completed');
        this.isRunning = false;
      }
      return;
    }
    const task = nextTask.value;
    this.queue.push(task);
    this.runningTasks.push(task);
    this.runTaskWithRetry(task)
      .then(() => {
        this.logger.log(LogLevel.INFO, 'Task completed');
        this.runningTasks = this.runningTasks.filter((t) => t !== task);
        this.completedTasks.push(task);
        this.runNextTask();
      })
      .catch(() => {
        this.logger.log(LogLevel.ERROR, 'Task failed');
        this.runningTasks = this.runningTasks.filter((t) => t !== task);
        this.failedTasks.push(task);
        this.runNextTask();
      });
  }

  private sleepWhileRunning(): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Returns the results of the PromiseSequencer.
   * If the option `throwOnError` is set to true, this method will throw an error if a task fails it will return the results for the fulfilled tasks.
   * If the option `throwOnError` is set to false, this method will return null for failed tasks.
   */
  async getResults(): Promise<(T | null)[]> {
    await this.sleepWhileRunning();
    return this.results;
  }

  /**
   * Returns the current queue of tasks.
   */
  getQueue(): (() => Promise<T>)[] {
    return this.queue;
  }

  /**
   * Returns the current running tasks.
   */
  getRunningTasks(): (() => Promise<T>)[] {
    return this.runningTasks;
  }

  /**
   * Returns the completed tasks.
   */
  getCompletedTasks(): (() => Promise<T>)[] {
    return this.completedTasks;
  }

  /**
   * Returns the failed tasks.
   */
  getFailedTasks(): (() => Promise<T>)[] {
    return this.failedTasks;
  }

  /**
   * Returns the tasks that are currently being retried.
   */
  getRetryTasks(): (() => Promise<T>)[] {
    return this.retryTasks;
  }

  setCurrentConcurrency(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * Returns the current status of the PromiseSequencer.
   */
  async start() {
    if (this.isRunning) {
      return false;
    }
    this.isRunning = true;
    this.logger.log(LogLevel.INFO, 'Starting promise sequencer...');
    for (let i = 0; i < this.concurrency; i++) {
      const nextTask = this.promiseGenerator.next();
      if (nextTask.done) {
        break;
      }
      const task = nextTask.value;
      this.queue.push(task);
      this.runningTasks.push(task);
      this.runTaskWithRetry(task)
        .then(() => {
          this.logger.log(LogLevel.INFO, 'Task completed');
          this.runningTasks = this.runningTasks.filter((t) => t !== task);
          this.completedTasks.push(task);
          this.runNextTask();
        })
        .catch(() => {
          this.logger.log(LogLevel.ERROR, 'Task failed');
          this.runningTasks = this.runningTasks.filter((t) => t !== task);
          this.failedTasks.push(task);
          this.runNextTask();
        });
    }
    return true;
  }

  /**
   * Stops the PromiseSequencer.
   */
  stop() {
    this.isRunning = false;
  }
}

/**
 * Creates a generator from an array of promises.
 * @example
 * ```ts
 * const promiseGenerator = generatorFromPromises([
 *  () => Promise.resolve("foo"),
 *  () => Promise.resolve("bar"),
 * ]);
 * ```
 */
function* generatorFromPromises<T>(
  promises: (() => Promise<T>)[],
): Generator<() => Promise<T>, void, unknown> {
  for (const promise of promises) {
    yield promise;
  }
}

/**
 * Creates a new PromiseSequencer.
 * @example
 * ```ts
 * const promiseSequencer = createPromiseSequencer(
 *  [() => Promise.resolve("foo"), () => Promise.resolve("bar")],
 *  {
 *    concurrency: 2,
 *    retryAttempts: 3,
 *    retryDelay: 1000,
 *    logger: {
 *      log: (level, message) => {
 *        console.log(`[${level.toUpperCase()}] ${message}`);
 *      },
 *    },
 *  }
 *);
 * ```
 */
function createPromiseSequencer<T>(
  promiseGenerator: Generator<() => Promise<T>, void, unknown> | (() => Promise<T>)[],
  options?: Omit<PromiseSequencerOptions<T>, 'promiseGenerator'>,
): PromiseSequencer<T> {
  if (Array.isArray(promiseGenerator)) {
    promiseGenerator = generatorFromPromises(promiseGenerator);
  }
  return new PromiseSequencer({ promiseGenerator, ...options });
}

export {
  AsyncSequenceError,
  AsyncSequenceResult,
  createPromiseSequencer,
  generatorFromPromises,
  Logger,
  LogLevel,
  PromiseSequencer,
  PromiseSequencerOptions,
};
export default createPromiseSequencer;
