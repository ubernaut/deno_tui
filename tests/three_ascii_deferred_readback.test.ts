import { Color } from "npm:three@0.183.2";
import { assertEquals, assertThrows } from "./deps.ts";
import { ThreeAsciiDeferredReadbackQueue } from "../src/three_ascii/deferred_readback.ts";
import type { ThreeAsciiReadbackLayout } from "../src/three_ascii/readback.ts";

const layout: ThreeAsciiReadbackLayout = {
  byteLength: 20,
  fillOffset: 0,
  colorOffset: 4,
  fillFloatLength: 1,
  edgeFloatLength: 0,
  colorFloatLength: 4,
};

Deno.test("deferred readback queue reuses free slots and applies backpressure", () => {
  let nextId = 0;
  const queue = new ThreeAsciiDeferredReadbackQueue<FakeDeferredReadbackBuffer>({ mapModeRead: 1 });
  const first = queue.nextBuffer(
    20,
    (_current, byteLength) => slot(new FakeDeferredReadbackBuffer(nextId++), byteLength),
  );
  const second = queue.nextBuffer(
    20,
    (_current, byteLength) => slot(new FakeDeferredReadbackBuffer(nextId++), byteLength),
  );

  assertEquals(first?.gpu.id, 0);
  assertEquals(second?.gpu.id, 1);

  queue.queue(first!, frameOptions());
  queue.queue(second!, frameOptions());
  assertEquals(
    queue.nextBuffer(20, (_current, byteLength) => slot(new FakeDeferredReadbackBuffer(nextId++), byteLength)),
    undefined,
  );
});

Deno.test("deferred readback queue consumes resolved frames and reports timing", async () => {
  let now = 10;
  const queue = new ThreeAsciiDeferredReadbackQueue<FakeDeferredReadbackBuffer>({
    mapModeRead: 1,
    now: () => now,
  });
  const buffer = new FakeDeferredReadbackBuffer(1, [14, 1, 0.2, 0.1, 1]);
  const readback = slot(buffer, buffer.source.byteLength);

  queue.queue(readback, frameOptions());
  now = 17;
  buffer.resolveMap();
  await Promise.resolve();
  const result = queue.consumeCompleted((pending) => {
    const source = new Float32Array(pending.slot.gpu.getMappedRange());
    return [[`\x1b[38;2;${source[1]};${source[2]};${source[3]}m█`]];
  }, (error) => new Error(String(error)));

  assertEquals(result.readbackMs, 7);
  assertEquals(result.grid, [["\x1b[38;2;1;0.20000000298023224;0.10000000149011612m█"]]);
  assertEquals(queue.lastCompletedGrid(), result.grid);
  assertEquals(buffer.getMappedRangeCalls, 1);
  assertEquals(buffer.unmapCalls, 1);
  assertEquals(queue.pending.length, 0);
});

Deno.test("deferred readback queue skips stale resolved frames after invalidation", async () => {
  const queue = new ThreeAsciiDeferredReadbackQueue<FakeDeferredReadbackBuffer>({ mapModeRead: 1 });
  const buffer = new FakeDeferredReadbackBuffer(1, [14, 1, 1, 1, 1]);
  queue.queue(slot(buffer, buffer.source.byteLength), frameOptions());
  queue.invalidate();
  buffer.resolveMap();
  await Promise.resolve();

  const result = queue.consumeCompleted(() => [["stale"]], (error) => new Error(String(error)));

  assertEquals(result.grid, undefined);
  assertEquals(buffer.getMappedRangeCalls, 0);
  assertEquals(buffer.unmapCalls, 1);
  assertEquals(queue.pending.length, 0);
  assertEquals(queue.lastCompletedGrid(), []);
});

Deno.test("deferred readback queue maps errors and destroys slots", async () => {
  const queue = new ThreeAsciiDeferredReadbackQueue<FakeDeferredReadbackBuffer>({ mapModeRead: 1 });
  const buffer = new FakeDeferredReadbackBuffer(1);
  const readback = slot(buffer, 20);
  queue.queue(readback, frameOptions());
  buffer.rejectMap("map failed");
  await Promise.resolve();

  assertThrows(
    () => queue.consumeCompleted(() => [["unused"]], (error) => new RangeError(String(error))),
    RangeError,
    "map failed",
  );
  assertEquals(buffer.unmapCalls, 0);

  const next = queue.nextBuffer(
    20,
    (current, byteLength) => current ?? slot(new FakeDeferredReadbackBuffer(2), byteLength),
  );
  queue.destroy();
  assertEquals(next?.gpu.destroyed, true);
  assertEquals(queue.pending.length, 0);
  assertEquals(queue.lastCompletedGrid(), []);
});

function frameOptions() {
  return {
    layout,
    columns: 1,
    rows: 1,
    terminalGlyphStyle: "blocks" as const,
    terminalEdgeBias: 1,
    backgroundColor: new Color(0x000000),
  };
}

function slot(gpu: FakeDeferredReadbackBuffer, byteLength: number) {
  return { gpu, byteLength };
}

class FakeDeferredReadbackBuffer {
  readonly source: ArrayBuffer;
  destroyed = false;
  getMappedRangeCalls = 0;
  unmapCalls = 0;
  private resolve?: () => void;
  private reject?: (error: unknown) => void;

  constructor(readonly id: number, values: number[] = []) {
    this.source = new Float32Array(values).buffer;
  }

  mapAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  resolveMap(): void {
    this.resolve?.();
  }

  rejectMap(error: unknown): void {
    this.reject?.(error);
  }

  getMappedRange(): ArrayBuffer {
    this.getMappedRangeCalls += 1;
    return this.source;
  }

  unmap(): void {
    this.unmapCalls += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }
}
