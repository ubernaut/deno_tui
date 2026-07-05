import { Color, PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { assertEquals, assertRejects } from "./deps.ts";
import {
  ThreeAsciiReadbackError,
  ThreeAsciiRenderer,
  withThreeAsciiMappedReadback,
} from "../src/three_ascii/renderer.ts";

Deno.test("ThreeAsciiRenderer skips unchanged uniform buffer uploads", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
  });
  let writes = 0;
  const internals = renderer as unknown as {
    device: { queue: { writeBuffer: () => void } };
    paramsBuffer: object;
    writeUniforms(effectState: unknown): void;
  };
  internals.device = { queue: { writeBuffer: () => writes += 1 } };
  internals.paramsBuffer = {};
  const effectState = {
    edges: true,
    fill: true,
    invertLuminance: false,
    exposure: 1,
    attenuation: 1,
    blendWithBase: 0,
    depthFalloff: 0,
    depthOffset: 0,
    edgeThreshold: 8,
    asciiColor: { r: 1, g: 1, b: 1 },
    backgroundColor: { r: 0, g: 0, b: 0 },
  };

  internals.writeUniforms(effectState);
  internals.writeUniforms(effectState);
  assertEquals(writes, 1);

  renderer.setTerminalEdgeBias(renderer.getTerminalEdgeBias());
  internals.writeUniforms(effectState);
  assertEquals(writes, 1);

  renderer.setTerminalEdgeBias(1.5);
  internals.writeUniforms(effectState);
  assertEquals(writes, 2);

  renderer.setSize(8, 4);
  internals.writeUniforms(effectState);
  assertEquals(writes, 2);

  renderer.setSize(9, 4);
  internals.writeUniforms(effectState);
  assertEquals(writes, 3);
});

Deno.test("ThreeAsciiRenderer marks compute resources dirty when terminal glyph style changes", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
    terminalGlyphStyle: "blocks",
  });
  const internals = renderer as unknown as {
    computeDirty: boolean;
  };

  internals.computeDirty = false;
  renderer.setTerminalGlyphStyle("blocks");
  assertEquals(internals.computeDirty, false);

  renderer.setTerminalGlyphStyle("glyphs");
  assertEquals(internals.computeDirty, true);
});

Deno.test("ThreeAsciiRenderer configures deferred readback queue depth", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
    readbackStrategy: "deferred",
    deferredReadbackSlots: 5,
  });
  const internals = renderer as unknown as {
    deferredReadbacks: { slotCount: number };
  };

  assertEquals(internals.deferredReadbacks.slotCount, 5);
});

Deno.test("ThreeAsciiRenderer avoids compute resource rebuilds for effect option updates", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
  });
  const internals = renderer as unknown as {
    asciiNode: { applyOptions: (options: unknown) => void };
    computeDirty: boolean;
    uniformDirty: boolean;
  };
  const patches: unknown[] = [];
  internals.asciiNode = {
    applyOptions: (options) => patches.push(options),
  };

  internals.computeDirty = false;
  internals.uniformDirty = false;
  renderer.setEffectOptions({ normalThreshold: 0.2 });
  assertEquals(internals.computeDirty, false);
  assertEquals(internals.uniformDirty, false);
  assertEquals(patches, [{ normalThreshold: 0.2 }]);

  renderer.setEffectOptions({ normalThreshold: 0.2 });
  assertEquals(patches, [{ normalThreshold: 0.2 }]);

  renderer.setEffectOptions({ edgeThreshold: 6 });
  assertEquals(internals.computeDirty, false);
  assertEquals(internals.uniformDirty, true);
  assertEquals(patches, [{ normalThreshold: 0.2 }, { edgeThreshold: 6 }]);

  internals.uniformDirty = false;
  renderer.setEffectOptions({ edgeThreshold: 6, backgroundColor: 0x000000 });
  assertEquals(internals.uniformDirty, false);
  assertEquals(patches, [{ normalThreshold: 0.2 }, { edgeThreshold: 6 }]);
});

Deno.test("ThreeAsciiRenderer wraps failed GPU readback mapping with a stable error", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
  });
  const cause = new Error("validation error occurred");
  let unmapped = false;
  const internals = renderer as unknown as {
    outputReadback: unknown;
    fillOutput: unknown;
    colorOutput: unknown;
    buildAnsiGridFromReadback(layout: unknown, backgroundColor: unknown): Promise<string[][]>;
  };
  internals.outputReadback = {
    byteLength: 8,
    gpu: {
      mapAsync: () => Promise.reject(cause),
      getMappedRange: () => new ArrayBuffer(8),
      unmap: () => {
        unmapped = true;
      },
    },
  };
  internals.fillOutput = { byteLength: 4, gpu: {} };
  internals.colorOutput = { byteLength: 4, gpu: {} };

  const error = await assertRejects(
    () =>
      internals.buildAnsiGridFromReadback(
        { byteLength: 8, fillOffset: 0, colorOffset: 4 },
        { r: 0, g: 0, b: 0 },
      ),
    ThreeAsciiReadbackError,
    "GPU readback unavailable",
  );

  assertEquals(error.code, "three-ascii-readback-unavailable");
  assertEquals(error.cause, cause);
  assertEquals(unmapped, false);
});

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

Deno.test("ThreeAsciiRenderer skips scene submission when deferred readbacks are saturated", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  const cachedGrid = [["cached"]];
  let sceneSubmissions = 0;
  let inspectCalls = 0;
  const internals = renderer as unknown as {
    deferredReadbacks: {
      consumeCompleted: () => { grid?: string[][]; readbackMs?: number };
      isSaturated: () => boolean;
      inspect: () => {
        slotCount: number;
        pending: number;
        unresolved: number;
        resolved: number;
        saturated: boolean;
        generation: number;
      };
      lastCompletedGrid: () => string[][];
    };
    renderScene: () => Promise<void>;
  };
  internals.deferredReadbacks = {
    consumeCompleted: () => ({}),
    isSaturated: () => true,
    inspect: () => {
      inspectCalls += 1;
      return {
        slotCount: 6,
        pending: 6,
        unresolved: 6,
        resolved: 0,
        saturated: true,
        generation: 0,
      };
    },
    lastCompletedGrid: () => cachedGrid,
  };
  internals.renderScene = () => {
    sceneSubmissions += 1;
    return Promise.resolve();
  };

  const frame = await renderer.renderFrame(0, undefined, { ansi: true });

  assertEquals(frame.grid, cachedGrid);
  assertEquals(sceneSubmissions, 0);
  assertEquals(inspectCalls, 1);
  assertEquals(renderer.inspectPerformance()?.deferredReadbackSaturated, true);
  assertEquals(renderer.inspectPerformance()?.deferredReadbackUnresolved, 6);
});

Deno.test("ThreeAsciiRenderer forces blocking recovery after saturated stale deferred frames", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
    deferredReadbackMaxStaleFrames: 2,
  });
  const cachedGrid = [["cached"]];
  const forcedFlags: boolean[] = [];
  let sceneSubmissions = 0;
  const internals = renderer as unknown as {
    deferredReadbacks: {
      consumeCompleted: () => { grid?: string[][]; readbackMs?: number };
      inspect: () => {
        slotCount: number;
        pending: number;
        unresolved: number;
        resolved: number;
        saturated: boolean;
        generation: number;
      };
      lastCompletedGrid: () => string[][];
      replaceLastCompletedGrid: (grid: string[][]) => void;
    };
    renderScene: () => Promise<void>;
    computeAnsiGrid: (
      effectState: unknown,
      completed?: { grid?: string[][]; readbackMs?: number },
      forceBlockingDeferredReadback?: boolean,
    ) => Promise<string[][]>;
  };
  internals.deferredReadbacks = {
    consumeCompleted: () => ({}),
    inspect: () => ({
      slotCount: 2,
      pending: 2,
      unresolved: 2,
      resolved: 0,
      saturated: true,
      generation: 0,
    }),
    lastCompletedGrid: () => cachedGrid,
    replaceLastCompletedGrid: () => {},
  };
  internals.renderScene = () => {
    sceneSubmissions += 1;
    return Promise.resolve();
  };
  internals.computeAnsiGrid = (_effectState, _completed, forceBlockingDeferredReadback = false) => {
    forcedFlags.push(forceBlockingDeferredReadback);
    return Promise.resolve(forceBlockingDeferredReadback ? [["fresh"]] : cachedGrid);
  };

  const first = await renderer.renderFrame(0, undefined, { ansi: true });
  const second = await renderer.renderFrame(0, undefined, { ansi: true });

  assertEquals(first.grid, cachedGrid);
  assertEquals(second.grid, [["fresh"]]);
  assertEquals(sceneSubmissions, 1);
  assertEquals(forcedFlags, [true]);
});

Deno.test("ThreeAsciiRenderer avoids blocking stale fallback while deferred readbacks are pending", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
    deferredReadbackMaxStaleFrames: 2,
  });
  const cachedGrid = [["cached"]];
  const forcedFlags: boolean[] = [];
  const internals = renderer as unknown as {
    deferredReadbacks: {
      consumeCompleted: () => { grid?: string[][]; readbackMs?: number };
      isSaturated: () => boolean;
      inspect: () => {
        slotCount: number;
        pending: number;
        unresolved: number;
        resolved: number;
        saturated: boolean;
        generation: number;
      };
      lastCompletedGrid: () => string[][];
    };
    renderScene: () => Promise<void>;
    computeAnsiGrid: (
      effectState: unknown,
      completed?: { grid?: string[][]; readbackMs?: number },
      forceBlockingDeferredReadback?: boolean,
    ) => Promise<string[][]>;
  };
  internals.deferredReadbacks = {
    consumeCompleted: () => ({}),
    isSaturated: () => false,
    inspect: () => ({
      slotCount: 6,
      pending: 1,
      unresolved: 1,
      resolved: 0,
      saturated: false,
      generation: 0,
    }),
    lastCompletedGrid: () => cachedGrid,
  };
  internals.renderScene = () => Promise.resolve();
  internals.computeAnsiGrid = (_effectState, _completed, forceBlockingDeferredReadback = false) => {
    forcedFlags.push(forceBlockingDeferredReadback);
    return Promise.resolve(forceBlockingDeferredReadback ? [["fresh"]] : cachedGrid);
  };

  const first = await renderer.renderFrame(0, undefined, { ansi: true });
  const second = await renderer.renderFrame(0, undefined, { ansi: true });

  assertEquals(first.grid, cachedGrid);
  assertEquals(second.grid, cachedGrid);
  assertEquals(forcedFlags, [false, false]);
});

Deno.test("ThreeAsciiRenderer reuses last completed grid while resolving deferred submission", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  let lastCompletedGridCalls = 0;
  const internals = renderer as unknown as {
    deferredReadbacks: {
      inspect: () => {
        slotCount: number;
        pending: number;
        unresolved: number;
        resolved: number;
        saturated: boolean;
        generation: number;
      };
      lastCompletedGrid: () => string[][];
      nextBuffer: () => undefined;
    };
    deferAnsiGridReadback(
      commandEncoder: unknown,
      readbackLayout: { byteLength: number },
      readbackCopyPlan: unknown,
      backgroundColor: unknown,
      deferredCompleted: { grid?: string[][]; readbackUnavailable?: boolean },
    ): Promise<string[][]>;
  };
  const cachedGrid: string[][] = [];
  internals.deferredReadbacks = {
    inspect: () => ({
      slotCount: 1,
      pending: 0,
      unresolved: 0,
      resolved: 0,
      saturated: false,
      generation: 0,
    }),
    lastCompletedGrid: () => {
      lastCompletedGridCalls += 1;
      return cachedGrid;
    },
    nextBuffer: () => undefined,
  };

  const grid = await internals.deferAnsiGridReadback(
    {},
    { byteLength: 4 },
    {},
    {},
    {},
  );

  assertEquals(grid, cachedGrid);
  assertEquals(lastCompletedGridCalls, 1);
});

Deno.test("ThreeAsciiRenderer cold deferred submission returns without blocking for bootstrap", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  const cachedGrid: string[][] = [];
  let queued = 0;
  let submitted = 0;
  let copied = 0;
  const internals = renderer as unknown as {
    device: { queue: { submit: (_commands: unknown[]) => void } };
    deferredReadbacks: {
      lastCompletedGrid: () => string[][];
      nextBuffer: (_byteLength: number, _ensure: unknown) => string;
      queue: (_slot: string, _options: unknown) => { mapPromise: Promise<void> };
    };
    copyReadbackCommands: (_commandEncoder: unknown, _readbackCopyPlan: unknown, _readback: string) => void;
    deferAnsiGridReadback(
      commandEncoder: { finish: () => unknown },
      readbackLayout: { byteLength: number },
      readbackCopyPlan: unknown,
      backgroundColor: Color,
      deferredCompleted: { grid?: string[][]; readbackUnavailable?: boolean },
    ): Promise<string[][]>;
  };
  internals.device = {
    queue: {
      submit: () => {
        submitted += 1;
      },
    },
  };
  internals.deferredReadbacks = {
    lastCompletedGrid: () => cachedGrid,
    nextBuffer: () => "slot",
    queue: () => {
      queued += 1;
      return { mapPromise: new Promise(() => {}) };
    },
  };
  internals.copyReadbackCommands = () => {
    copied += 1;
  };

  const grid = await internals.deferAnsiGridReadback(
    { finish: () => ({}) },
    { byteLength: 4 },
    {},
    new Color("#000000"),
    {},
  );

  assertEquals(grid, cachedGrid);
  assertEquals(copied, 1);
  assertEquals(submitted, 1);
  assertEquals(queued, 1);
});

Deno.test("ThreeAsciiRenderer forces a blocking deferred readback after stale cached frames with no pending readback", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
    deferredReadbackMaxStaleFrames: 2,
  });
  const cachedGrid = [["cached"]];
  const forcedFlags: boolean[] = [];
  const internals = renderer as unknown as {
    deferredReadbacks: {
      consumeCompleted: () => { grid?: string[][]; readbackMs?: number };
      inspect: () => {
        slotCount: number;
        pending: number;
        unresolved: number;
        resolved: number;
        saturated: boolean;
        generation: number;
      };
      lastCompletedGrid: () => string[][];
    };
    renderScene: () => Promise<void>;
    computeAnsiGrid: (
      effectState: unknown,
      completed?: { grid?: string[][]; readbackMs?: number },
      forceBlockingDeferredReadback?: boolean,
    ) => Promise<string[][]>;
  };
  internals.deferredReadbacks = {
    consumeCompleted: () => ({}),
    inspect: () => ({
      slotCount: 6,
      pending: 0,
      unresolved: 0,
      resolved: 0,
      saturated: false,
      generation: 0,
    }),
    lastCompletedGrid: () => cachedGrid,
  };
  internals.renderScene = () => Promise.resolve();
  internals.computeAnsiGrid = (_effectState, _completed, forceBlockingDeferredReadback = false) => {
    forcedFlags.push(forceBlockingDeferredReadback);
    return Promise.resolve(forceBlockingDeferredReadback ? [["fresh"]] : cachedGrid);
  };

  const first = await renderer.renderFrame(0, undefined, { ansi: true });
  const second = await renderer.renderFrame(0, undefined, { ansi: true });

  assertEquals(first.grid, cachedGrid);
  assertEquals(second.grid, [["fresh"]]);
  assertEquals(forcedFlags, [false, true]);
});

Deno.test("ThreeAsciiRenderer isolates deferred readback failures without demoting", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  let destroyed = 0;
  const internals = renderer as unknown as {
    readbackStrategy: string;
    deferredReadbacks: {
      consumeCompleted: () => never;
      destroy: () => void;
      lastCompletedGrid: () => string[][];
    };
    consumeDeferredAnsiGrid(): { grid?: string[][]; readbackUnavailable?: boolean };
  };
  const cachedGrid = [["cached"]];
  internals.deferredReadbacks = {
    consumeCompleted: () => {
      throw new ThreeAsciiReadbackError(new Error("deferred map rejected"));
    },
    destroy: () => {
      destroyed += 1;
    },
    lastCompletedGrid: () => cachedGrid,
  };

  assertEquals(internals.consumeDeferredAnsiGrid(), {
    grid: cachedGrid,
    readbackUnavailable: true,
  });
  assertEquals(internals.readbackStrategy, "deferred");
  assertEquals(destroyed, 1);
});

Deno.test("ThreeAsciiRenderer skips immediate blocking fallback after deferred readback failure", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  const cachedGrid = [["cached"]];
  let sceneSubmissions = 0;
  const internals = renderer as unknown as {
    deferredReadbacks: {
      consumeCompleted: () => never;
      destroy: () => void;
      lastCompletedGrid: () => string[][];
    };
    renderScene: () => Promise<void>;
  };
  internals.deferredReadbacks = {
    consumeCompleted: () => {
      throw new ThreeAsciiReadbackError(new Error("deferred map rejected"));
    },
    destroy: () => {},
    lastCompletedGrid: () => cachedGrid,
  };
  internals.renderScene = () => {
    sceneSubmissions += 1;
    return Promise.resolve();
  };

  const frame = await renderer.renderFrame(0, undefined, { ansi: true });

  assertEquals(frame.grid, cachedGrid);
  assertEquals(sceneSubmissions, 0);
});

Deno.test("ThreeAsciiRenderer skips post-compute blocking fallback after deferred readback failure", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
    readbackStrategy: "deferred",
  });
  const cachedGrid = [["cached"]];
  const internals = renderer as unknown as {
    readbackStrategy: string;
    deferAnsiGridReadback(
      commandEncoder: unknown,
      readbackLayout: unknown,
      readbackCopyPlan: unknown,
      backgroundColor: unknown,
      deferredCompleted: { grid?: string[][]; readbackUnavailable?: boolean },
    ): Promise<string[][]>;
  };
  internals.readbackStrategy = "blocking";

  const grid = await internals.deferAnsiGridReadback(
    {},
    {},
    {},
    {},
    { grid: cachedGrid, readbackUnavailable: true },
  );

  assertEquals(grid, cachedGrid);
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
