import { demos as neonDemos } from "./neon_theme.ts";
import type { Accent, VisualizationDescriptor } from "./types.ts";

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
