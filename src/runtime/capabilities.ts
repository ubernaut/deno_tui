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

/** Public type alias for a runtime Worker Strategy. */
export type RuntimeWorkerStrategy = "worker-pool" | "main-thread";
/** Public type alias for a runtime Storage Strategy. */
export type RuntimeStorageStrategy = "indexeddb" | "memory";
/** Public type alias for a runtime Renderer Strategy. */
export type RuntimeRendererStrategy = "webgpu" | "webgl" | "cpu";

/** Preferences for deriving runtime strategies from detected capabilities. */
export interface RuntimePlanOptions {
  preferWorkers?: boolean;
  preferPersistentStorage?: boolean;
  preferGpuRenderer?: boolean;
  allowWebGlFallback?: boolean;
}

/** One selected runtime strategy plus the capability that drove it. */
export interface RuntimePlanDecision<TStrategy extends string, TCapability extends RuntimeCapabilityId> {
  strategy: TStrategy;
  accelerated: boolean;
  capability?: TCapability;
  reason: string;
}

/** Deterministic runtime strategy plan for apps, demos, and renderer backends. */
export interface RuntimePlan {
  capabilities: RuntimeCapabilities;
  workers: RuntimePlanDecision<RuntimeWorkerStrategy, "workers">;
  storage: RuntimePlanDecision<RuntimeStorageStrategy, "indexedDb">;
  renderer: RuntimePlanDecision<RuntimeRendererStrategy, "webgpu" | "webgl">;
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

/** Builds a deterministic strategy plan from runtime capabilities and app preferences. */
export function createRuntimePlan(
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
  options: RuntimePlanOptions = {},
): RuntimePlan {
  const preferWorkers = options.preferWorkers ?? true;
  const preferPersistentStorage = options.preferPersistentStorage ?? true;
  const preferGpuRenderer = options.preferGpuRenderer ?? true;
  const allowWebGlFallback = options.allowWebGlFallback ?? true;

  return {
    capabilities,
    workers: preferWorkers && capabilities.workers
      ? {
        strategy: "worker-pool",
        accelerated: true,
        capability: "workers",
        reason: "Workers are available and preferred for background work.",
      }
      : {
        strategy: "main-thread",
        accelerated: false,
        reason: preferWorkers
          ? "Workers are unavailable, so work should run on the main thread."
          : "Worker usage was disabled by runtime plan preferences.",
      },
    storage: preferPersistentStorage && capabilities.indexedDb
      ? {
        strategy: "indexeddb",
        accelerated: true,
        capability: "indexedDb",
        reason: "IndexedDB is available and preferred for persistent settings.",
      }
      : {
        strategy: "memory",
        accelerated: false,
        reason: preferPersistentStorage
          ? "IndexedDB is unavailable, so settings should use memory or a custom store."
          : "Persistent storage was disabled by runtime plan preferences.",
      },
    renderer: rendererDecision(capabilities, preferGpuRenderer, allowWebGlFallback),
  };
}

/** Formats a runtime plan as concise CLI/status text. */
export function formatRuntimePlan(plan: RuntimePlan): string {
  return [
    "Runtime plan:",
    `workers  ${plan.workers.strategy} (${plan.workers.reason})`,
    `storage  ${plan.storage.strategy} (${plan.storage.reason})`,
    `renderer ${plan.renderer.strategy} (${plan.renderer.reason})`,
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

function rendererDecision(
  capabilities: RuntimeCapabilities,
  preferGpuRenderer: boolean,
  allowWebGlFallback: boolean,
): RuntimePlanDecision<RuntimeRendererStrategy, "webgpu" | "webgl"> {
  if (!preferGpuRenderer) {
    return {
      strategy: "cpu",
      accelerated: false,
      reason: "GPU renderer usage was disabled by runtime plan preferences.",
    };
  }
  if (capabilities.webgpu) {
    return {
      strategy: "webgpu",
      accelerated: true,
      capability: "webgpu",
      reason: "WebGPU is available and preferred for accelerated rendering.",
    };
  }
  if (allowWebGlFallback && capabilities.webgl) {
    return {
      strategy: "webgl",
      accelerated: true,
      capability: "webgl",
      reason: "WebGPU is unavailable, but WebGL fallback rendering is available.",
    };
  }
  return {
    strategy: "cpu",
    accelerated: false,
    reason: allowWebGlFallback
      ? "No GPU renderer capability is available, so rendering should use CPU fallbacks."
      : "WebGPU is unavailable and WebGL fallback rendering was disabled.",
  };
}
