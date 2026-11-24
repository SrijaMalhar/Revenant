import type { WorkerIn, WorkerOut } from '../workers/soul.worker.ts';

export function newWorker(): Worker {
  return new Worker(new URL('../workers/soul.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Sends one message to a fresh worker and resolves with its first final
 * answer. The worker is terminated on answer, on error and on timeout, so a
 * pathological input can't freeze anything.
 */
export function once(msg: WorkerIn, timeoutMs: number): Promise<WorkerOut> {
  return new Promise((resolve) => {
    const w = newWorker();
    const timer = setTimeout(() => {
      w.terminate();
      resolve({ type: 'error', message: `Stopped after ${timeoutMs / 1000} seconds.` });
    }, timeoutMs);
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === 'progress') return;
      clearTimeout(timer);
      w.terminate();
      resolve(e.data);
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      w.terminate();
      resolve({ type: 'error', message: e.message || 'The worker failed to start.' });
    };
    w.postMessage(msg);
  });
}
