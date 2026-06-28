// Copyright 2023 Im-Beast. MIT license.
/** Optional platform capabilities that can accelerate or persist TUI workloads. */
export interface RuntimeCapabilities {
  workers: boolean;
  webgpu: boolean;
  webgl: boolean;
  offscreenCanvas: boolean;
  indexedDb: boolean;
}

/** Stable identifier for one runtime capability. */
export type RuntimeCapabilityId = keyof RuntimeCapabilities;

/** Display metadata for one runtime capability probe. */
export interface RuntimeCapabilityEntry {
  id: RuntimeCapabilityId;
  label: string;
  available: boolean;
  description: string;
}

/** Aggregate capability probe result for status panels and diagnostics. */
export interface RuntimeCapabilitySummary {
  total: number;
  available: number;
  missing: number;
  entries: RuntimeCapabilityEntry[];
}

const CAPABILITY_METADATA: Record<RuntimeCapabilityId, Omit<RuntimeCapabilityEntry, "id" | "available">> = {
  workers: {
    label: "Workers",
    description: "Background module or classic workers for off-main-thread work.",
  },
  webgpu: {
    label: "WebGPU",
    description: "GPU compute and rendering APIs for accelerated terminal visualizations.",
  },
  webgl: {
    label: "WebGL",
    description: "Canvas WebGL context support for graphics fallbacks.",
  },
  offscreenCanvas: {
    label: "OffscreenCanvas",
    description: "Canvas rendering outside the main UI context.",
  },
  indexedDb: {
    label: "IndexedDB",
    description: "Persistent browser-style structured storage.",
  },
};

interface CanvasLike {
  getContext(type: string): unknown;
}

/** Detects optional standards APIs on the provided global scope. */
export function detectRuntimeCapabilities(scope: typeof globalThis = globalThis): RuntimeCapabilities {
  const offscreenCanvas = "OffscreenCanvas" in scope;
  return {
    workers: "Worker" in scope,
    webgpu: Boolean(scope.navigator && "gpu" in scope.navigator),
    webgl: canCreateWebGlContext(scope, offscreenCanvas),
    offscreenCanvas,
    indexedDb: "indexedDB" in scope,
  };
}

/** Converts raw capability booleans into labeled display entries. */
export function runtimeCapabilityEntries(capabilities: RuntimeCapabilities): RuntimeCapabilityEntry[] {
  return (Object.keys(CAPABILITY_METADATA) as RuntimeCapabilityId[]).map((id) => ({
    id,
    ...CAPABILITY_METADATA[id],
    available: capabilities[id],
  }));
}

/** Summarizes capability availability counts and labeled entries. */
export function summarizeRuntimeCapabilities(
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeCapabilitySummary {
  const entries = runtimeCapabilityEntries(capabilities);
  const available = entries.filter((entry) => entry.available).length;
  return {
    total: entries.length,
    available,
    missing: entries.length - available,
    entries,
  };
}

/** Formats runtime capabilities as concise CLI/status text. */
export function formatRuntimeCapabilities(
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): string {
  const summary = summarizeRuntimeCapabilities(capabilities);
  const rows = summary.entries.map((entry) => `${entry.available ? "ok" : "missing"} ${entry.label}`);
  return [
    `Runtime capabilities: ${summary.available}/${summary.total} available`,
    ...rows,
  ].join("\n");
}

function canCreateWebGlContext(scope: typeof globalThis, offscreenCanvas: boolean): boolean {
  try {
    if (offscreenCanvas) {
      const CanvasCtor = (scope as typeof globalThis & {
        OffscreenCanvas?: new (width: number, height: number) => CanvasLike;
      }).OffscreenCanvas;
      return Boolean(CanvasCtor && new CanvasCtor(1, 1).getContext("webgl"));
    }
    const document = (scope as typeof globalThis & {
      document?: { createElement(tagName: "canvas"): CanvasLike };
    }).document;
    return Boolean(document?.createElement("canvas").getContext("webgl"));
  } catch {
    return false;
  }
}
