import { demos as neonDemos } from "./neon_theme.ts";
import type { Accent, SlotId, VisualizationDescriptor } from "./types.ts";

export type VisualizationFamily = "monitor" | "neon" | "neon3d";

export interface VisualizationCatalogEntry extends VisualizationDescriptor {
  family: VisualizationFamily;
}

export const monitorVisualizationCatalog: readonly VisualizationCatalogEntry[] = [
  {
    id: "cpu-monitor",
    name: "CPU Monitor",
    accent: "signal",
    description: "Bottom-style CPU overview and history plot.",
    family: "monitor",
  },
  { id: "cpu-legend", name: "CPU Legend", accent: "signal", description: "Per-core legend wall.", family: "monitor" },
  {
    id: "cpu-hex-grid",
    name: "CPU Hex Grid",
    accent: "signal",
    description: "Per-core hex tile activity map with truecolor load shading.",
    family: "monitor",
  },
  {
    id: "gpu-combined-monitor",
    name: "GPU Fusion",
    accent: "violet",
    description: "Combined GPU chip and VRAM pressure view.",
    family: "monitor",
  },
  {
    id: "gpu-chip-monitor",
    name: "GPU Chip",
    accent: "violet",
    description: "GPU utilization, thermals, power, and clocks.",
    family: "monitor",
  },
  {
    id: "gpu-memory-monitor",
    name: "GPU Memory",
    accent: "phosphor",
    description: "Dedicated GPU memory bank pressure.",
    family: "monitor",
  },
  {
    id: "memory-monitor",
    name: "Memory Monitor",
    accent: "phosphor",
    description: "Memory, swap, and load pressure.",
    family: "monitor",
  },
  {
    id: "temperature-monitor",
    name: "Temperature Monitor",
    accent: "violet",
    description: "Thermal zone readout.",
    family: "monitor",
  },
  {
    id: "disk-monitor",
    name: "Disk Monitor",
    accent: "amber",
    description: "Filesystem capacity board.",
    family: "monitor",
  },
  {
    id: "network-monitor",
    name: "Network Monitor",
    accent: "signal",
    description: "Ingress, egress, and interface status.",
    family: "monitor",
  },
  {
    id: "process-monitor",
    name: "Process Monitor",
    accent: "amber",
    description: "Top process activity table.",
    family: "monitor",
  },
];

const preferredVisualizationIdsBySlot: Record<SlotId, string[]> = {
  cpu: [
    "three-lattice",
    "harmonic-graph",
    "biosignal-strip",
    "telemetry-rack",
    "cpu-monitor",
    "cpu-hex-grid",
    "field-ring",
    "three-solenoid",
  ],
  cpuLegend: [
    "cpu-legend",
    "cpu-hex-grid",
    "channel-matrix",
    "telemetry-rack",
    "harmonic-graph",
    "counter-board",
    "component-index",
  ],
  gpu: [
    "gpu-combined-monitor",
    "three-atfield",
    "field-ring",
    "telemetry-rack",
    "magi-board",
    "three-solenoid",
  ],
  gpuChip: [
    "gpu-chip-monitor",
    "three-lattice",
    "biosignal-strip",
    "harmonic-graph",
    "gate-status",
  ],
  gpuMemory: [
    "gpu-memory-monitor",
    "hex-heatmap",
    "three-hexshell",
    "channel-matrix",
    "counter-board",
  ],
  memory: [
    "three-hexshell",
    "hex-heatmap",
    "field-ring",
    "telemetry-rack",
    "memory-monitor",
    "three-atfield",
  ],
  temperature: [
    "three-capture",
    "warning-stack",
    "field-ring",
    "temperature-monitor",
    "three-atfield",
    "psychograph",
  ],
  disk: [
    "three-mapslab",
    "tactical-map",
    "route-board",
    "hex-heatmap",
    "disk-monitor",
  ],
  network: [
    "three-solenoid",
    "network-topology",
    "route-board",
    "channel-matrix",
    "biosignal-strip",
    "network-monitor",
    "three-atfield",
  ],
  processes: [
    "process-monitor",
    "event-log",
    "channel-matrix",
    "telemetry-rack",
    "warning-stack",
    "route-board",
    "counter-board",
    "three-capture",
  ],
};

export function defaultVisualizationForSlot(slotId: SlotId): string {
  return preferredVisualizationIdsBySlot[slotId][0]!;
}

export function orderVisualizationsForSlot<T extends { id: string }>(slotId: SlotId, entries: readonly T[]): T[] {
  const preferred = preferredVisualizationIdsBySlot[slotId];
  const indexById = new Map(preferred.map((id, index) => [id, index]));

  return [...entries].sort((left, right) => {
    const leftIndex = indexById.get(left.id);
    const rightIndex = indexById.get(right.id);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) {
      return -1;
    }
    if (rightIndex !== undefined) {
      return 1;
    }
    return 0;
  });
}

export const neonThreeVisualizationIds = [
  "three-lattice",
  "three-atfield",
  "three-hexshell",
  "three-capture",
  "three-mapslab",
  "three-solenoid",
  "three-ascii-studio",
] as const;

export const neonVisualizationIds = [
  "warning-stack",
  "counter-board",
  "profile-card",
  "live-feed",
  "event-log",
  "channel-matrix",
  "telemetry-rack",
  "biosignal-strip",
  "harmonic-graph",
  "psychograph",
  "field-ring",
  "hex-heatmap",
  "magi-board",
  "route-board",
  "gate-status",
  "tactical-map",
  "network-topology",
  "component-index",
] as const;

const neonVisualizationIdSet = new Set<string>(neonVisualizationIds);
const neonThreeVisualizationIdSet = new Set<string>(neonThreeVisualizationIds);
const neonVisualizationMap = new Map(
  neonDemos
    .filter((demo) => neonVisualizationIdSet.has(demo.id) || neonThreeVisualizationIdSet.has(demo.id))
    .map((demo) => [demo.id, demo] as const),
);

export const neonThreeVisualizationCatalog: readonly VisualizationCatalogEntry[] = neonThreeVisualizationIds.map((
  id,
) => {
  const demo = neonVisualizationMap.get(id);
  return {
    id,
    name: demo?.title ?? id,
    accent: (demo?.accent ?? "signal") as Accent,
    description: demo?.subtitle ?? "Neon Exodus 3D visualization.",
    family: "neon3d",
  };
});

export const neonVisualizationCatalog: readonly VisualizationCatalogEntry[] = neonVisualizationIds.map((id) => {
  const demo = neonVisualizationMap.get(id);
  return {
    id,
    name: demo?.title ?? id,
    accent: (demo?.accent ?? "signal") as Accent,
    description: demo?.subtitle ?? "Neon Exodus visualization.",
    family: "neon",
  };
});

export const visualizationCatalog: readonly VisualizationCatalogEntry[] = [
  ...monitorVisualizationCatalog,
  ...neonThreeVisualizationCatalog,
  ...neonVisualizationCatalog,
];

export const visualizationCatalogById = new Map(visualizationCatalog.map((entry) => [entry.id, entry]));

export function visualizationFamily(id: string): VisualizationFamily | undefined {
  return visualizationCatalogById.get(id)?.family;
}

export function visualizationsByFamily(family: VisualizationFamily): VisualizationCatalogEntry[] {
  return visualizationCatalog.filter((entry) => entry.family === family).map((entry) => ({ ...entry }));
}
