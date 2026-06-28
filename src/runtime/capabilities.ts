// Copyright 2023 Im-Beast. MIT license.
export interface RuntimeCapabilities {
  workers: boolean;
  webgpu: boolean;
  webgl: boolean;
  offscreenCanvas: boolean;
  indexedDb: boolean;
}

export type RuntimeCapabilityId = keyof RuntimeCapabilities;

export interface RuntimeCapabilityEntry {
  id: RuntimeCapabilityId;
  label: string;
  available: boolean;
  description: string;
}

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

export function runtimeCapabilityEntries(capabilities: RuntimeCapabilities): RuntimeCapabilityEntry[] {
  return (Object.keys(CAPABILITY_METADATA) as RuntimeCapabilityId[]).map((id) => ({
    id,
    ...CAPABILITY_METADATA[id],
    available: capabilities[id],
  }));
}

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
