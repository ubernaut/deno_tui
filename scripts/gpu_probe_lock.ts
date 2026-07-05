export interface GpuProbeLockOptions {
  path?: string;
  staleMs?: number;
  pollMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface GpuProbeLockHandle {
  path: string;
  release(): Promise<void>;
}

const DEFAULT_LOCK_PATH = ".cache/deno-tui-gpu-probe.lock";
const DEFAULT_STALE_MS = 120_000;
const DEFAULT_POLL_MS = 100;
const DEFAULT_TIMEOUT_MS = 180_000;

/** Serializes local WebGPU probe/smoke commands so concurrent runs do not spuriously lose the device. */
export async function withGpuProbeLock<T>(
  run: () => T | Promise<T>,
  options: GpuProbeLockOptions = {},
): Promise<T> {
  const lock = await acquireGpuProbeLock(options);
  try {
    return await run();
  } finally {
    await lock.release();
  }
}

export async function acquireGpuProbeLock(options: GpuProbeLockOptions = {}): Promise<GpuProbeLockHandle> {
  const path = options.path ?? DEFAULT_LOCK_PATH;
  const staleMs = Math.max(1, Math.floor(options.staleMs ?? DEFAULT_STALE_MS));
  const pollMs = Math.max(1, Math.floor(options.pollMs ?? DEFAULT_POLL_MS));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  await Deno.mkdir(parentDirectory(path), { recursive: true });

  while (true) {
    try {
      const file = await Deno.open(path, { createNew: true, write: true });
      const token = `${Deno.pid}:${new Date(now()).toISOString()}\n`;
      await file.write(new TextEncoder().encode(token));
      file.close();
      return {
        path,
        release: async () => {
          try {
            await Deno.remove(path);
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
        },
      };
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
    }

    await removeStaleGpuProbeLock(path, staleMs, now);
    if (now() - started > timeoutMs) {
      throw new Error(`timed out waiting for GPU probe lock: ${path}`);
    }
    await sleep(pollMs);
  }
}

async function removeStaleGpuProbeLock(path: string, staleMs: number, now: () => number): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (stat.mtime && now() - stat.mtime.getTime() <= staleMs) return;
    await Deno.remove(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
}

function parentDirectory(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "." : path.slice(0, index);
}
