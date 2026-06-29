import type { SlotId } from "./types.ts";

const preferredVisualizationIdsBySlot: Record<SlotId, string[]> = {
  cpu: [
    "three-lattice",
    "harmonic-graph",
    "biosignal-strip",
    "telemetry-rack",
    "cpu-monitor",
    "field-ring",
    "three-solenoid",
  ],
  cpuLegend: [
    "cpu-legend",
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

export function defaultVisualizationForSlot(slotId: SlotId) {
  return preferredVisualizationIdsBySlot[slotId][0];
}

export function orderVisualizationsForSlot<T extends { id: string }>(slotId: SlotId, entries: readonly T[]) {
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
