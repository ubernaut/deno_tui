import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  destroyThreeAsciiGpuBufferSlot,
  ensureThreeAsciiGpuBufferSlot,
  type ThreeAsciiGpuBuffer,
  type ThreeAsciiGpuBufferDevice,
} from "../src/three_ascii/gpu_buffers.ts";

class FakeBuffer implements ThreeAsciiGpuBuffer {
  destroyed = false;

  constructor(readonly label: string, readonly size: number, readonly usage: number) {}

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeDevice implements ThreeAsciiGpuBufferDevice<FakeBuffer> {
  readonly buffers: FakeBuffer[] = [];

  createBuffer(options: { label: string; size: number; usage: number }): FakeBuffer {
    const buffer = new FakeBuffer(options.label, options.size, options.usage);
    this.buffers.push(buffer);
    return buffer;
  }
}

Deno.test("ensureThreeAsciiGpuBufferSlot reuses same-sized buffers", () => {
  const device = new FakeDevice();
  const first = ensureThreeAsciiGpuBufferSlot(device, undefined, {
    label: "first",
    byteLength: 64,
    usage: 3,
  });
  const second = ensureThreeAsciiGpuBufferSlot(device, first, {
    label: "second",
    byteLength: 64,
    usage: 7,
  });

  assertStrictEquals(second, first);
  assertEquals(device.buffers.length, 1);
  assertEquals(first.gpu.destroyed, false);
  assertEquals(first.gpu.label, "first");
  assertEquals(first.gpu.usage, 3);
});

Deno.test("ensureThreeAsciiGpuBufferSlot replaces and destroys resized buffers", () => {
  const device = new FakeDevice();
  const first = ensureThreeAsciiGpuBufferSlot(device, undefined, {
    label: "small",
    byteLength: 16,
    usage: 1,
  });
  const second = ensureThreeAsciiGpuBufferSlot(device, first, {
    label: "large",
    byteLength: 32,
    usage: 5,
  });

  assertEquals(first.gpu.destroyed, true);
  assertEquals(second === first, false);
  assertEquals(second.byteLength, 32);
  assertEquals(second.gpu.label, "large");
  assertEquals(second.gpu.usage, 5);
  assertEquals(device.buffers.length, 2);
});

Deno.test("destroyThreeAsciiGpuBufferSlot destroys optional slots and returns undefined", () => {
  const device = new FakeDevice();
  const slot = ensureThreeAsciiGpuBufferSlot(device, undefined, {
    label: "slot",
    byteLength: 8,
    usage: 2,
  });

  assertEquals(destroyThreeAsciiGpuBufferSlot(slot), undefined);
  assertEquals(slot.gpu.destroyed, true);
  assertEquals(destroyThreeAsciiGpuBufferSlot(undefined), undefined);
});
