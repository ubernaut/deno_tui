import { assertEquals, assertRejects } from "./deps.ts";
import { withThreeAsciiMappedReadback } from "../src/three_ascii/renderer.ts";

Deno.test("withThreeAsciiMappedReadback measures map time and unmaps after reading", async () => {
  const source = new ArrayBuffer(8);
  const buffer = new FakeMappedReadbackBuffer(source);
  const times = [10, 16];
  const result = await withThreeAsciiMappedReadback(buffer, {
    mapModeRead: 1,
    now: () => times.shift() ?? 16,
    mapError: (error) => new Error(`mapped ${String(error)}`),
    read: (mapped, readbackMs) => ({ mapped, readbackMs }),
  });

  assertEquals(result, { value: { mapped: source, readbackMs: 6 }, readbackMs: 6 });
  assertEquals(buffer.mapModes, [1]);
  assertEquals(buffer.unmapped, 1);
});

Deno.test("withThreeAsciiMappedReadback wraps map errors without unmapping", async () => {
  const cause = new Error("denied");
  const buffer = new FakeMappedReadbackBuffer(new ArrayBuffer(4), cause);
  const error = await assertRejects(
    () =>
      withThreeAsciiMappedReadback(buffer, {
        mapModeRead: 2,
        now: () => 0,
        mapError: (mapped) => new TypeError("mapped failure", { cause: mapped }),
        read: () => "unreachable",
      }),
    TypeError,
    "mapped failure",
  );

  assertEquals(error.cause, cause);
  assertEquals(buffer.mapModes, [2]);
  assertEquals(buffer.unmapped, 0);
});

Deno.test("withThreeAsciiMappedReadback unmaps when reader throws", async () => {
  const buffer = new FakeMappedReadbackBuffer(new ArrayBuffer(4));
  await assertRejects(
    () =>
      withThreeAsciiMappedReadback(buffer, {
        mapModeRead: 3,
        now: () => 0,
        mapError: (error) => new Error(String(error)),
        read: () => {
          throw new RangeError("reader failed");
        },
      }),
    RangeError,
    "reader failed",
  );

  assertEquals(buffer.unmapped, 1);
});

class FakeMappedReadbackBuffer {
  readonly mapModes: number[] = [];
  unmapped = 0;

  constructor(private readonly source: ArrayBuffer, private readonly mapError?: unknown) {}

  mapAsync(mode: number): Promise<void> {
    this.mapModes.push(mode);
    return this.mapError ? Promise.reject(this.mapError) : Promise.resolve();
  }

  getMappedRange(): ArrayBuffer {
    return this.source;
  }

  unmap(): void {
    this.unmapped += 1;
  }
}
