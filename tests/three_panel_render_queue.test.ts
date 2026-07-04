import { assertEquals, assertRejects } from "./deps.ts";
import { ThreePanelRenderQueue } from "../src/app/three_panel_render_queue.ts";

Deno.test("ThreePanelRenderQueue serializes queued frame work", async () => {
  const queue = new ThreePanelRenderQueue();
  const order: string[] = [];
  const releaseFirst = deferred<void>();

  const first = queue.run(async () => {
    order.push("first:start");
    await releaseFirst.promise;
    order.push("first:end");
    return "first";
  });
  const second = queue.run(() => {
    order.push("second");
    return "second";
  });

  await waitFor(() => order.length === 1);
  assertEquals(order, ["first:start"]);
  assertEquals(queue.inspect().running, 1);
  assertEquals(queue.inspect().pending, 1);

  releaseFirst.resolve();
  assertEquals(await Promise.all([first, second]), ["first", "second"]);
  assertEquals(order, ["first:start", "first:end", "second"]);
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 2,
    failed: 0,
  });
});

Deno.test("ThreePanelRenderQueue continues after a failed frame", async () => {
  const queue = new ThreePanelRenderQueue();
  const error = new Error("frame failed");

  await assertRejects(
    () =>
      queue.run(() => {
        throw error;
      }),
    Error,
    "frame failed",
  );

  assertEquals(await queue.run(() => "next"), "next");
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 1,
    failed: 1,
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for render queue state");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
