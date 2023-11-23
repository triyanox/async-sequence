# async-sequence

**async-sequence** contains **PromiseSequencer** a utility class that enables you to execute promises sequentially with concurrency and retry capabilities. It empowers you to manage promise execution order, concurrency, and handles retries and logging seamlessly.

<img
  src="https://raw.githubusercontent.com/triyanox/async-sequence/main/assets/banner.png" alt="async-sequence banner"
  title="iamjs" align="center" 
  height="auto" 
  width="100%"
 />

## Installation

Install **async-sequence** using your preferred package manager:

```bash
# Using npm
npm install @triyanox/async-sequence

# Using Bun
bun add @triyanox/async-sequence

# Using Yarn
yarn add @triyanox/async-sequence

# Using PNPM
pnpm add @triyanox/async-sequence

```

## Usage

```ts
import createPromiseSequencer from '@triyanox/async-sequence';

// Example usage
const promiseSequencer = createPromiseSequencer(
  // add your promises here
  [() => Promise.resolve('foo'), () => Promise.reject('bar')],
  {
    // the maximum number of promises that can run at the same time
    concurrency: 2,
    // the maximum number of times a task can be retried
    retryAttempts: 3,
    // the delay between retries
    retryDelay: 1000,
    // a logger that logs the status of the PromiseSequencer
    logger: {
      log: (level, message) => {
        console.log(`[${level.toUpperCase()}] ${message}`);
      },
    },
    // callbacks for when a task is completed, failed or retried
    onTaskCompleted: (result) => {
      console.log(`Task completed with result: ${result()}`);
    },
    onTaskFailed: (error) => {
      console.log(`Task failed with error: ${error()}`);
    },
    onTaskRetried: (task) => {
      console.log(`Task retried: ${task}`);
    },
    // whether to disable logs
    disableLogs: false,
  },
);

// use a custom generator
const promiseSequencer = createPromiseSequencer(
  (function* custom() {
    yield () => Promise.resolve('foo');
    yield () => Promise.resolve('bar');
    yield () => Promise.reject(new Error('baz'));
  })(),
);

// start the PromiseSequencer
promiseSequencer.start();

// get the sequencer results
const results = await promiseSequencer.getResults();

// stop the PromiseSequencer
promiseSequencer.stop();
```

## API

### Enum: LogLevel

Represents different log levels for logging messages.

- `ERROR`: Error log level.
- `INFO`: Information log level.
- `DEBUG`: Debug log level.

### Interface: Logger

A logger interface to implement custom logging behavior.

- `log(level: LogLevel, message: string): void`: Logs a message at the specified log level.

### Interface: PromiseSequencerOptions\<T>

Options for configuring the PromiseSequencer.

- `promiseGenerator`: A generator that yields promises.
- `concurrency` (optional): The number of promises to run concurrently. Default: 1.
- `retryAttempts` (optional): The number of times to retry a failed task. Default: 0.
- `retryDelay` (optional): The delay in milliseconds between retries. Default: 0.
- `logger` (optional): A logger instance for custom logging. Default: console.
- `disableLogs` (optional): Whether to disable logging. Default: false.
- `onTaskCompleted` (optional): A callback for task completion.
- `onTaskFailed` (optional): A callback for task failure.
- `onTaskRetried` (optional): A callback for task retries.
- `throwOnErrors` (optional): Whether to throw an error when a task fails. Default: false.

### Class: PromiseSequencer\<T>

A class for executing promises sequentially with concurrency and retry capabilities.

- `constructor(options: PromiseSequencerOptions<T>)`: Creates a new PromiseSequencer instance.
- `start(): Promise<boolean>`: Starts executing promises.
- `stop()`: Stops the PromiseSequencer.
- `getQueue(): (() => Promise<T>)[]`: Returns the current queue of tasks.
- `getRunningTasks(): (() => Promise<T>)[]`: Returns the current running tasks.
- `getCompletedTasks(): (() => Promise<T>)[]`: Returns the completed tasks.
- `getFailedTasks(): (() => Promise<T>)[]`: Returns the failed tasks.
- `getRetryTasks(): (() => Promise<T>)[]`: Returns the tasks that are currently being retried.
- `getResults(): Promise<T[]>`: Returns the results of the PromiseSequencer if the `throwOnErrors` option is set to `false` it will return null for the failed tasks if not it will throw an error.
- `setCurrentConcurrency(concurrency: number): void`: Sets the current concurrency.

### Function: createPromiseSequencer\<T>

Creates a new PromiseSequencer instance.

- `promiseGenerator`: A generator that yields promises.
- `options` (optional): Options for configuring the PromiseSequencer.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
