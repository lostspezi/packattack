import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

export const RESERVATION_QUEUE = "reservation-jobs";
export const SUBSTITUTION_QUEUE = "substitution-jobs";

const queueCache = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let queue = queueCache.get(name);
  if (!queue) {
    queue = new Queue(name, { connection });
    queueCache.set(name, queue);
  }
  return queue;
}

export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection,
    ...opts,
  });
}
