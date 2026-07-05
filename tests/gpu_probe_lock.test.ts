import { assertEquals, assertRejects } from "./deps.ts";
import { acquireGpuProbeLock, withGpuProbeLock } from "../scripts/gpu_probe_lock.ts";

Deno.test("GPU probe lock creates and releases an exclusive file", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/probe.lock`;
  try {
    const lock = await acquireGpuProbeLock({ path, pollMs: 1, timeoutMs: 20 });
    assertEquals(await exists(path), true);
    await assertRejects(
      () => acquireGpuProbeLock({ path, pollMs: 1, timeoutMs: 5, staleMs: 60_000 }),
      Error,
      "timed out waiting for GPU probe lock",
    );
    await lock.release();
    assertEquals(await exists(path), false);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => undefined);
  }
});

Deno.test("GPU probe lock removes stale files and wraps callbacks", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/probe.lock`;
  try {
    await Deno.writeTextFile(path, "stale");
    const old = new Date(Date.now() - 10_000);
    await Deno.utime(path, old, old);
    const result = await withGpuProbeLock(() => "ok", { path, staleMs: 1, pollMs: 1, timeoutMs: 100 });
    assertEquals(result, "ok");
    assertEquals(await exists(path), false);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => undefined);
  }
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
