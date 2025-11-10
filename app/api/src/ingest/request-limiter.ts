export interface RequestLimiterOptions {
  initialConcurrency?: number;
  minConcurrency?: number;
  maxConcurrency?: number;
}

type AwaitableTask<T> = () => Promise<T>;

/**
 * Simple adaptive limiter that bounds concurrent ESI calls and reacts to the
 * X-Esi-Error-Limit-* headers. It is intentionally lightweight so ingestion
 * jobs can reuse it without pulling in additional dependencies.
 */
export class RequestLimiter {
  private readonly minConcurrency: number;
  private readonly maxConcurrency: number;
  private readonly queue: Array<() => void> = [];
  private activeTasks = 0;
  private currentConcurrency: number;

  constructor(options: RequestLimiterOptions = {}) {
    const min = Math.max(1, options.minConcurrency ?? 1);
    const max = Math.max(min, options.maxConcurrency ?? Math.max(min, options.initialConcurrency ?? 4));
    const initial = Math.min(Math.max(options.initialConcurrency ?? 4, min), max);

    this.minConcurrency = min;
    this.maxConcurrency = max;
    this.currentConcurrency = initial;
  }

  get concurrency(): number {
    return this.currentConcurrency;
  }

  get pending(): number {
    return this.queue.length;
  }

  schedule<T>(task: AwaitableTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runner = () => {
        this.activeTasks += 1;
        void task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.activeTasks -= 1;
            this.drainQueue();
          });
      };

      if (this.activeTasks < this.currentConcurrency) {
        runner();
      } else {
        this.queue.push(runner);
      }
    });
  }

  adjustFromHeaders(headers: Headers | Record<string, string | null | undefined>): void {
    const remain = this.readHeaderNumber(headers, "x-esi-error-limit-remain");
    const reset = this.readHeaderNumber(headers, "x-esi-error-limit-reset");

    if (remain !== null && remain <= 5) {
      // Aggressive reduction when the error budget is critically low.
      this.currentConcurrency = Math.max(this.minConcurrency, Math.floor(this.currentConcurrency / 2) || 1);
      return;
    }

    if (remain !== null && reset !== null) {
      // When plenty of budget remains and reset window is far, slowly increase.
      if (remain >= 80 && reset > 1 && this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency += 1;
      }
      return;
    }

    if (remain !== null && remain >= 50 && this.currentConcurrency < this.maxConcurrency) {
      this.currentConcurrency += 1;
    }
  }

  private readHeaderNumber(source: Headers | Record<string, string | null | undefined>, key: string): number | null {
    const raw = source instanceof Headers
      ? source.get(key)
      : source?.[key] ?? null;
    if (raw == null) {
      return null;
    }
    const value = Number.parseInt(String(raw), 10);
    return Number.isFinite(value) ? value : null;
  }

  private drainQueue(): void {
    while (this.activeTasks < this.currentConcurrency) {
      const task = this.queue.shift();
      if (!task) {
        break;
      }
      task();
    }
  }
}
