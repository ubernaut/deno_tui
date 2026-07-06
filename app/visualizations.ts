import { neonThreeSceneModeLabel } from "./neon_three.ts";
import { demos as neonDemos, formatCountdown as neonFormatCountdown } from "./neon_theme.ts";
import { clamp, formatRate } from "./styles.ts";
import {
  buildVisualizationDrive,
  fallbackSource,
  moduloUnit,
  sampleSeries,
  sampleSeriesValue,
  type VisualizationDrive,
} from "./visualization_drive.ts";
import {
  alertText,
  barChart,
  clampInt,
  createMatrix,
  crop,
  drawEllipse,
  drawLine,
  driveAlert,
  gridify,
  hottestAccent,
  miniMeter,
  monitorGlyph,
  plotHistory,
  renderMatrix,
  sceneAlert,
  setCell,
  signalChart,
  sourceDetailFooter,
  sourceFooter,
  sourceNameMatrix,
  sourceWarnings,
} from "./visualization_primitives.ts";
import {
  renderCpuHexGrid,
  renderCpuLegend,
  renderCpuMonitor,
  renderDiskMonitor,
  renderGpuChipMonitor,
  renderGpuCombinedMonitor,
  renderGpuMemoryMonitor,
  renderMemoryMonitor,
  renderProcessMonitor,
  renderTemperatureMonitor,
} from "./visualization_system.ts";
import type {
  Accent,
  PanelRender,
  RenderContext,
  SlotId,
  ThreeSceneMode,
  ThreeSceneSignal,
  VisualizationDescriptor,
} from "./types.ts";

export { buildVisualizationDrive } from "./visualization_drive.ts";
export type { VisualizationDrive, VisualizationSourceDrive } from "./visualization_drive.ts";
export {
  cpuActivityRgb,
  cpuHexGridColumnCount,
  cpuHexTileLayout,
  cpuHexTileLayoutInto,
  cpuHexTileScrollTarget,
  nextCpuHexLabel,
  processMatchesCpuLabel,
  selectedCpuHexTilesWith,
  topCpuProcessLabelForCpu,
} from "./visualization_system.ts";
export type {
  CpuHexNavigationKey,
  CpuHexScrollOffset,
  CpuHexScrollTargetOptions,
  CpuHexTileLayout,
} from "./visualization_system.ts";

function normalizeFieldRows(lines: readonly string[], width: number, height: number) {
  const visible = Math.min(lines.length, Math.max(1, height));
  const rows = new Array<string>(Math.max(visible, height));
  for (let index = 0; index < visible; index += 1) {
    rows[index] = crop(lines[index]!, width).padEnd(width, " ");
  }
  const emptyRow = " ".repeat(width);
  for (let index = visible; index < height; index += 1) {
    rows[index] = emptyRow;
  }
  return rows.join("\n");
}

export function harmonicField(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const spacing = Math.max(3, 7 - Math.round(drive.divergence * 4));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + y + Math.floor(drive.phase * 0.25)) % spacing === 0) {
        setCell(matrix, x, y, "·");
      }
    }
  }

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const amplitudeX = Math.max(3, Math.floor(width * (0.16 + drive.current * 0.24 + drive.divergence * 0.08)));
  const amplitudeY = Math.max(2, Math.floor(height * (0.18 + drive.density * 0.26)));
  const traces = Math.max(2, Math.min(4, drive.activeCount + 1));

  for (let trace = 0; trace < traces; trace += 1) {
    const source = drive.sources[trace % drive.sources.length]!;
    let previousX = centerX;
    let previousY = centerY;
    for (let step = 0; step < Math.max(width * 2, 48); step += 1) {
      const t = (step / Math.max(width * 2 - 1, 1)) * Math.PI * 2;
      const phase = drive.phase * 0.04 + trace * 0.9 + source.normalizedValue * 1.6;
      const x = Math.round(
        centerX +
          Math.sin(t * (2 + drive.cadence * 2 + trace * 0.25) + phase) * amplitudeX * (0.72 + trace * 0.08),
      );
      const y = Math.round(
        centerY +
          Math.sin(t * (3 + drive.divergence * 2.5) - phase) * amplitudeY +
          Math.cos(t * (1.5 + source.volatility * 3) + phase) * amplitudeY * 0.34,
      );
      drawLine(matrix, previousX, previousY, x, y, glyph);
      previousX = x;
      previousY = y;
    }
  }

  return renderMatrix(matrix);
}

export function psychograph(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const drift = drive.current * 0.9 + drive.volatility * 0.8;
  let previousX = 0;
  let previousY = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    const local = drive.pulseSeries[x % drive.pulseSeries.length] ?? drive.current;
    const y = Math.round(
      height / 2 +
        Math.sin(x * (0.26 + drive.cadence * 0.24) + drive.phase * 0.13) * (height * 0.18 + drift * 2.4) +
        Math.cos(x * (0.09 + drive.divergence * 0.18) - drive.phase * 0.07) * (height * 0.1 + local * 2.2) +
        Math.sin(x * 0.51 + drive.phase * 0.17) * drive.volatility * 2.6,
    );
    drawLine(matrix, previousX, previousY, x, y, glyph);
    if ((x + drive.phase) % Math.max(5, 11 - Math.round(drive.volatility * 8)) === 0) {
      setCell(matrix, x, clampInt(y + Math.round(local * 2 - 1), 0, height - 1), "•");
    }
    previousX = x;
    previousY = y;
  }
  return renderMatrix(matrix);
}

export function circularField(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const outerX = Math.max(4, Math.floor(width * (0.2 + drive.current * 0.12 + drive.divergence * 0.08)));
  const outerY = Math.max(2, Math.floor(height * (0.26 + drive.density * 0.12)));
  const ringCount = Math.max(2, Math.min(4, 2 + Math.round(drive.hazard * 2)));

  for (let ring = 0; ring < ringCount; ring += 1) {
    const inset = ring * 2;
    drawEllipse(
      matrix,
      centerX,
      centerY,
      Math.max(2, outerX - inset),
      Math.max(1, outerY - Math.floor(inset / 2)),
      ring === ringCount - 1 ? "◎" : "◌",
    );
  }

  drawLine(
    matrix,
    centerX,
    Math.max(0, centerY - outerY - 2),
    centerX,
    Math.min(height - 1, centerY + outerY + 2),
    "│",
  );
  drawLine(matrix, Math.max(0, centerX - outerX - 4), centerY, Math.min(width - 1, centerX + outerX + 4), centerY, "─");
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.max(0, centerY - outerY),
    Math.min(width - 1, centerX + outerX),
    Math.min(height - 1, centerY + outerY),
    "╱",
  );
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.min(height - 1, centerY + outerY),
    Math.min(width - 1, centerX + outerX),
    Math.max(0, centerY - outerY),
    "╲",
  );
  setCell(matrix, centerX, centerY, drive.hazard >= 0.88 ? "█" : "◆");
  return renderMatrix(matrix);
}

export function heatmap(width: number, height: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, height, " ");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = drive.normalizedSeries[(x + y) % drive.normalizedSeries.length] ?? drive.current;
      const pulse = drive.pulseSeries[(x * 2 + y) % drive.pulseSeries.length] ?? drive.current;
      const spread = drive.spreadSeries[(x + y * 2) % drive.spreadSeries.length] ?? drive.divergence;
      const value = clamp(
        seed * 0.42 +
          pulse * 0.24 +
          spread * 0.16 +
          ((Math.sin((x + drive.phase) * (0.13 + drive.cadence * 0.08)) +
              Math.cos((y - drive.phase) * (0.21 + drive.volatility * 0.12)) +
              2) / 4) * 0.18,
        0,
        1,
      );
      const glyphIndex = Math.min(glyphs.length - 1, Math.floor(value * glyphs.length));
      setCell(matrix, x, y, glyphs[glyphIndex] ?? glyphs[glyphs.length - 1] ?? "#");
    }
  }
  return renderMatrix(matrix);
}

export function routeBoard(width: number, rows: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, rows, " ");
  const lanes = Math.max(2, Math.min(4, drive.sources.length + 1));
  for (let row = 0; row < rows; row += 1) {
    const source = drive.sources[row % drive.sources.length] ?? drive.primary;
    const spread = drive.spreadSeries[row % drive.spreadSeries.length] ?? drive.divergence;
    const limit = Math.floor(
      clamp(source.normalizedSeries[row % source.normalizedSeries.length] * 0.72 + spread * 0.28, 0, 1) * (width - 1),
    );
    const cursor = Math.floor(moduloUnit(drive.scan + row / Math.max(rows, 1) + source.slope * 0.25) * (width - 1));
    for (let column = 0; column < width; column += 1) {
      const onLane = (row + column + lanes) % Math.max(3, lanes + 1) === 0;
      const filled = column <= limit;
      const glyph = column === cursor
        ? "█"
        : filled
        ? glyphs[glyphs.length - 1] ?? "#"
        : onLane
        ? glyphs[2] ?? "▂"
        : glyphs[1] ?? ".";
      setCell(matrix, column, row, glyph);
    }
  }
  return renderMatrix(matrix);
}

export function tacticalMap(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const bias = 2 + drive.divergence * 5;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + Math.floor(Math.sin(y * (0.42 + drive.cadence * 0.22) + drive.phase * 0.08) * bias)) % 7 === 0) {
        setCell(matrix, x, y, "~");
      }
    }
  }

  const scanX = Math.floor(moduloUnit(drive.scan + drive.cadence * 0.2) * Math.max(1, width - 1));
  for (let y = 0; y < height; y += 1) {
    const x = clampInt(scanX - Math.floor(y / 2), 0, width - 1);
    setCell(matrix, x, y, "/");
    setCell(matrix, Math.min(width - 1, x + 1), y, "/");
  }

  const targets = Math.max(1, Math.min(3, drive.activeCount + 1));
  for (let target = 0; target < targets; target += 1) {
    const left = clampInt(Math.floor(width * (0.18 + target * 0.23 + drive.divergence * 0.08)), 1, width - 4);
    const top = clampInt(Math.floor(height * (0.18 + target * 0.16)), 1, height - 3);
    const right = clampInt(left + Math.max(3, Math.floor(width * 0.12)), left + 2, width - 2);
    const bottom = clampInt(top + Math.max(2, Math.floor(height * 0.18)), top + 1, height - 2);
    drawLine(matrix, left, top, right, top, "┄");
    drawLine(matrix, left, bottom, right, bottom, "┄");
    drawLine(matrix, left, top, left, bottom, "┆");
    drawLine(matrix, right, top, right, bottom, "┆");
  }

  return renderMatrix(matrix);
}

export function networkTopology(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const offset = Math.floor(drive.divergence * 4 + drive.volatility * 3);
  const nodes = [
    [2, 2],
    [Math.floor(width * 0.24), 5],
    [Math.floor(width * 0.46), 2],
    [Math.floor(width * 0.7), 6],
    [width - 4, 3],
    [6, height - 4],
    [Math.floor(width * 0.34), height - 5],
    [Math.floor(width * 0.6), height - 3],
    [width - 8, height - 4],
  ] as const;

  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [1, 6],
    [2, 6],
    [2, 7],
    [3, 7],
    [4, 8],
    [5, 6],
    [6, 7],
    [7, 8],
  ] as const;

  edges.forEach(([from, to], edgeIndex) => {
    const pulse = drive.pulseSeries[(edgeIndex * 3 + offset) % drive.pulseSeries.length] ?? drive.current;
    const hot = pulse >= 0.68 || (drive.phase + edgeIndex + offset) % 7 === 0;
    drawLine(matrix, nodes[from][0], nodes[from][1], nodes[to][0], nodes[to][1], hot ? "╳" : "─");
  });

  nodes.forEach(([x, y], index) => {
    const pulse = drive.normalizedSeries[(index * 2 + offset) % drive.normalizedSeries.length] ?? drive.current;
    setCell(matrix, x, y, pulse >= 0.72 ? "█" : (drive.phase + index + offset) % 9 === 0 ? "◆" : "●");
  });

  return renderMatrix(matrix);
}

export function liveFeed(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = drive.pulseSeries[(x + y) % drive.pulseSeries.length] ?? drive.current;
      const noise = Math.sin((x + drive.phase) * (0.28 + drive.cadence * 0.2) + wave) +
        Math.cos((y - drive.phase) * (0.6 + drive.volatility * 0.3) - drive.current);
      setCell(matrix, x, y, noise > 1.05 ? "█" : noise > 0.55 ? "▓" : noise > 0.08 ? "▒" : noise > -0.3 ? "░" : " ");
    }
  }

  const left = Math.floor(width * (0.22 + drive.divergence * 0.08));
  const top = Math.floor(height * (0.16 + drive.volatility * 0.08));
  const right = Math.min(width - 2, left + Math.max(4, Math.floor(width * (0.28 + drive.current * 0.12))));
  const bottom = Math.min(height - 2, top + Math.max(3, Math.floor(height * (0.42 + drive.density * 0.1))));
  drawLine(matrix, left, top, right, top, "─");
  drawLine(matrix, left, bottom, right, bottom, "─");
  drawLine(matrix, left, top, left, bottom, "│");
  drawLine(matrix, right, top, right, bottom, "│");
  return renderMatrix(matrix);
}

export function channelMatrix(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const sourceCount = Math.max(1, drive.sources.length);
  const laneWidth = Math.max(3, Math.floor(width / sourceCount));
  drive.sources.forEach((source, index) => {
    const start = index * laneWidth;
    const end = Math.min(width - 1, start + laneWidth - 1);
    const sampled = sampleSeries(source.normalizedSeries, Math.max(1, end - start));
    for (let x = start; x < end; x += 1) {
      const local = sampled[x - start] ?? source.normalizedValue;
      const filled = Math.max(1, Math.round(local * Math.max(1, height - 1)));
      for (let row = height - 1; row >= 0; row -= 1) {
        const fromBottom = height - row;
        if (fromBottom <= filled) {
          setCell(matrix, x, row, drive.hazard >= 0.9 ? "█" : local >= 0.66 ? "▓" : "▒");
        } else if ((row + x + drive.phase) % Math.max(3, 8 - Math.round(drive.volatility * 5)) === 0) {
          setCell(matrix, x, row, "·");
        }
      }
    }
    if (end < width) {
      for (let row = 0; row < height; row += 1) {
        setCell(matrix, end, row, "│");
      }
    }
  });
  return renderMatrix(matrix);
}

export function telemetryRack(
  width: number,
  height: number,
  drive: VisualizationDrive,
  blocks: readonly string[],
) {
  const lines: string[] = [];
  const meterWidth = Math.max(4, Math.min(12, width - 18));
  const sourceLines = Math.min(drive.sources.length, Math.max(1, Math.min(3, height - 2)));
  for (let index = 0; index < sourceLines; index += 1) {
    const source = drive.sources[index]!;
    lines.push(
      `${crop(source.source.name.toUpperCase(), 8).padEnd(8, " ")} ${
        miniMeter(source.normalizedValue, meterWidth, drive.hazard)
      } ${Math.round(source.normalizedValue * 100).toString().padStart(3, " ")}`,
    );
  }
  const chartHeight = Math.max(1, height - lines.length);
  const chart = barChart(drive.pulseSeries, width, chartHeight, blocks);
  return normalizeFieldRows([...lines, ...chart.split("\n")], width, height);
}

export function biosignalStrip(width: number, height: number, drive: VisualizationDrive) {
  const header = height >= 6
    ? [
      `PULSE ${(drive.current * 100).toFixed(0)}%  NOISE ${(drive.volatility * 100).toFixed(0)}%  Δ${
        (drive.divergence * 100).toFixed(0)
      }%`,
    ]
    : [];
  const chartHeight = Math.max(2, height - header.length);
  return normalizeFieldRows(
    [...header, ...signalChart(drive.pulseSeries, width, chartHeight, monitorGlyph(drive, "phosphor")).split("\n")],
    width,
    height,
  );
}

export function componentIndex(
  width: number,
  height: number,
  drive: VisualizationDrive,
  labels: readonly string[],
) {
  const header = `INDEX ${(drive.current * 100).toFixed(0)}%  Δ${
    (drive.divergence * 100).toFixed(0)
  }  SRC ${drive.activeCount}/${drive.sources.length}`;
  const entries = new Array<string>(labels.length);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index]!;
    const pulse = drive.pulseSeries[index % drive.pulseSeries.length] ?? drive.current;
    const marker = pulse >= 0.82 ? "█" : pulse >= 0.6 ? "▓" : pulse >= 0.36 ? "▒" : "░";
    entries[index] = `${marker} ${label.toUpperCase()}`;
  }
  return normalizeFieldRows([header, ...gridify(entries, width).split("\n")], width, height);
}

type VisualizationFamily = "monitor" | "neon" | "neon3d";

interface VisualizationCatalogEntry extends VisualizationDescriptor {
  family: VisualizationFamily;
}

const monitorVisualizationCatalog: readonly VisualizationCatalogEntry[] = [
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

const neonThreeVisualizationIds = [
  "three-lattice",
  "three-atfield",
  "three-hexshell",
  "three-capture",
  "three-mapslab",
  "three-solenoid",
  "three-ascii-studio",
] as const;

const neonVisualizationIds = [
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

const neonThreeVisualizationCatalog: readonly VisualizationCatalogEntry[] = neonThreeVisualizationIds.map((
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

const neonVisualizationCatalog: readonly VisualizationCatalogEntry[] = neonVisualizationIds.map((id) => {
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

const visualizationCatalogById = new Map(visualizationCatalog.map((entry) => [entry.id, entry]));

export function visualizationFamily(id: string): VisualizationFamily | undefined {
  return visualizationCatalogById.get(id)?.family;
}

export function visualizationsByFamily(family: VisualizationFamily): VisualizationCatalogEntry[] {
  return visualizationCatalog.filter((entry) => entry.family === family).map((entry) => ({ ...entry }));
}

export const visualizations: VisualizationDescriptor[] = visualizationCatalog.map((entry) => ({ ...entry }));

const visualizationMap = new Map(visualizationCatalogById);
const neonDemoIds = new Set(neonDemos.map((demo) => demo.id));
const neonDemoTitles = new Array<string>(neonDemos.length);
for (let index = 0; index < neonDemos.length; index += 1) {
  neonDemoTitles[index] = neonDemos[index]!.title;
}
const textOnlyNeonDemoIds = new Set(["warning-stack", "event-log", "component-index"]);
const ngePrimitiveSceneModes: Record<string, ThreeSceneMode> = {
  "counter-board": "counter",
  "profile-card": "plug",
  "live-feed": "surveillance",
  "channel-matrix": "relay",
  "telemetry-rack": "rack",
  "biosignal-strip": "biosignal",
  "harmonic-graph": "harmonic",
  "psychograph": "psychograph",
  "field-ring": "field",
  "hex-heatmap": "heat",
  "magi-board": "magi",
  "route-board": "route",
  "gate-status": "gate",
  "tactical-map": "command",
  "network-topology": "topology",
};

type VisualizationRenderFn = (context: RenderContext, descriptor: VisualizationDescriptor) => PanelRender;

const threeSceneVisualizationModes: Record<string, ThreeSceneMode> = {
  "three-lattice": "lattice",
  "three-atfield": "atfield",
  "three-hexshell": "hexshell",
  "three-capture": "capture",
  "three-mapslab": "mapslab",
  "three-solenoid": "solenoid",
  "three-ascii-studio": "studio",
};

const THREE_FALLBACK_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function threeSceneModeLabel(mode: ThreeSceneMode) {
  return neonThreeSceneModeLabel(mode);
}

export function appendThreeSceneFooter(footer: string, mode: ThreeSceneMode, width: number): string {
  const suffix = `${threeSceneModeLabel(mode)} PRIMITIVES`;
  if (!footer) return suffix;
  return `${crop(footer, Math.max(0, width - suffix.length - 3))} / ${suffix}`;
}

export function renderThreeFallbackBody(context: RenderContext, drive: VisualizationDrive, mode: ThreeSceneMode) {
  const width = Math.max(12, context.width);
  const infoLines = [
    crop(
      `${threeSceneModeLabel(mode)} DRIVE ${Math.round(drive.hazard * 100)}%  Δ${Math.round(drive.divergence * 100)}`,
      width,
    ),
  ];

  if (context.height >= 6) {
    infoLines.push(crop(sourceNameMatrix(context.sources), width));
  }

  const chartHeight = Math.max(2, context.height - infoLines.length);
  const chart = (() => {
    switch (mode) {
      case "lattice":
      case "solenoid":
        return signalChart(drive.pulseSeries, width, chartHeight, drive.hazard >= 0.78 ? "█" : "▇");
      case "atfield":
      case "capture":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "hexshell":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "mapslab":
        return routeBoard(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "studio":
        return harmonicField(width, chartHeight, drive, "◆");
      case "emergency":
      case "counter":
      case "relay":
        return routeBoard(width, chartHeight, drive, [" ", "░", "▒", "▓", "█"]);
      case "launch":
      case "gate":
      case "route":
        return signalChart(drive.spreadSeries, width, chartHeight, drive.hazard >= 0.78 ? "▓" : "▒");
      case "harmonic":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "field":
        return circularField(width, chartHeight, drive);
      case "magi":
      case "angel":
      case "plug":
      case "rack":
      case "heat":
      case "command":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "target":
        return circularField(width, chartHeight, drive);
      case "waveform":
      case "scope":
      case "biosignal":
      case "psychograph":
      case "surveillance":
      case "topology":
        return psychograph(width, chartHeight, drive, monitorGlyph(drive, "signal"));
    }
  })();

  return [...infoLines, chart].join("\n");
}

export function driveThreeSignal(
  context: RenderContext,
  drive: VisualizationDrive,
  mode: ThreeSceneMode,
): ThreeSceneSignal {
  const modeBias = modeTwist(mode);
  const wobble = Math.sin((drive.phase + modeBias.phase) * modeBias.speed);
  const twist = clamp(drive.imbalance * 1.2 + wobble * modeBias.offset * (0.6 + drive.divergence * 0.8), -1, 1);
  const lift = clamp(
    drive.slope * 1.7 + drive.jerk * 0.55 + modeBias.lift * (drive.current - 0.5) +
      Math.cos(drive.phase * 0.09) * 0.12,
    -1,
    1,
  );
  const pulse = clamp(0.12 + drive.current * 0.3 + drive.volatility * 0.2 + drive.hazard * 0.38, 0.12, 1);
  const depth = clamp(0.14 + drive.absolute * 0.24 + drive.divergence * 0.16 + drive.hazard * 0.34, 0.12, 0.98);

  return {
    x: clamp(0.5 + twist * 0.22 + Math.sin((drive.phase + modeBias.phase) * 0.04) * drive.cadence * 0.08, 0, 1),
    y: clamp(0.5 - lift * 0.22 + Math.cos((drive.phase + modeBias.phase) * 0.05) * drive.volatility * 0.07, 0, 1),
    depth,
    twist,
    lift,
    pulse,
    active: pulse > 0.18 || drive.activeCount > 0,
    pressed: context.system.alerts.some((alert) => alert.severity === "alarm") || drive.hazard >= 0.9,
  };
}

export function modeTwist(mode: ThreeSceneMode) {
  switch (mode) {
    case "lattice":
      return { phase: 0, speed: 0.12, offset: 0.18, lift: 0.32 };
    case "atfield":
      return { phase: 5, speed: 0.1, offset: 0.24, lift: 0.24 };
    case "hexshell":
      return { phase: 9, speed: 0.08, offset: 0.2, lift: 0.5 };
    case "capture":
      return { phase: 13, speed: 0.11, offset: 0.26, lift: 0.18 };
    case "mapslab":
      return { phase: 17, speed: 0.07, offset: 0.14, lift: 0.58 };
    case "solenoid":
      return { phase: 21, speed: 0.14, offset: 0.22, lift: 0.28 };
    case "studio":
      return { phase: 25, speed: 0.09, offset: 0.3, lift: 0.2 };
    case "emergency":
      return { phase: 29, speed: 0.16, offset: 0.32, lift: 0.16 };
    case "counter":
      return { phase: 31, speed: 0.13, offset: 0.18, lift: 0.12 };
    case "plug":
      return { phase: 32, speed: 0.08, offset: 0.16, lift: 0.3 };
    case "surveillance":
      return { phase: 34, speed: 0.09, offset: 0.24, lift: 0.18 };
    case "relay":
      return { phase: 35, speed: 0.15, offset: 0.26, lift: 0.2 };
    case "rack":
      return { phase: 36, speed: 0.14, offset: 0.2, lift: 0.16 };
    case "scope":
      return { phase: 38, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "biosignal":
      return { phase: 38, speed: 0.2, offset: 0.32, lift: 0.3 };
    case "harmonic":
      return { phase: 39, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "psychograph":
      return { phase: 40, speed: 0.17, offset: 0.36, lift: 0.32 };
    case "field":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.24 };
    case "heat":
      return { phase: 39, speed: 0.1, offset: 0.22, lift: 0.42 };
    case "route":
      return { phase: 40, speed: 0.1, offset: 0.2, lift: 0.48 };
    case "topology":
      return { phase: 42, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "command":
      return { phase: 44, speed: 0.07, offset: 0.16, lift: 0.18 };
    case "launch":
      return { phase: 33, speed: 0.1, offset: 0.2, lift: 0.5 };
    case "magi":
      return { phase: 37, speed: 0.06, offset: 0.14, lift: 0.18 };
    case "target":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.22 };
    case "waveform":
      return { phase: 45, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "angel":
      return { phase: 49, speed: 0.08, offset: 0.22, lift: 0.48 };
    case "gate":
      return { phase: 53, speed: 0.12, offset: 0.18, lift: 0.42 };
  }
}

const directVisualizationRenderers: Record<string, (context: RenderContext) => PanelRender> = {
  "cpu-monitor": (context) => renderCpuMonitor(context, systemMonitorDependencies),
  "cpu-legend": (context) => renderCpuLegend(context, systemMonitorDependencies),
  "cpu-hex-grid": renderCpuHexGrid,
  "gpu-combined-monitor": (context) => renderGpuCombinedMonitor(context, gpuMonitorDependencies),
  "gpu-chip-monitor": (context) => renderGpuChipMonitor(context, gpuMonitorDependencies),
  "gpu-memory-monitor": (context) => renderGpuMemoryMonitor(context, gpuMonitorDependencies),
  "memory-monitor": (context) => renderMemoryMonitor(context, systemMonitorDependencies),
  "temperature-monitor": (context) => renderTemperatureMonitor(context, systemMonitorDependencies),
  "disk-monitor": (context) => renderDiskMonitor(context, systemMonitorDependencies),
  "network-monitor": (context) => renderNetworkMonitor(context, { plotHistory, monitorGlyph }),
  "process-monitor": renderProcessMonitor,
  "warning-stack": renderWarningStack,
  "counter-board": renderCounterBoard,
  "profile-card": renderProfileCard,
  "live-feed": renderLiveFeed,
  "event-log": renderEventLog,
  "channel-matrix": renderChannelMatrix,
  "telemetry-rack": renderTelemetryRack,
  "biosignal-strip": renderBiosignalStrip,
  "harmonic-graph": renderHarmonicGraph,
  "psychograph": renderPsychograph,
  "field-ring": renderFieldRing,
  "hex-heatmap": renderHeatmap,
  "magi-board": renderMagiBoard,
  "route-board": renderRouteBoard,
  "gate-status": renderGateStatus,
  "tactical-map": renderTacticalMap,
  "network-topology": renderNetworkTopology,
  "component-index": renderComponentIndex,
};

const visualizationRenderers: Record<string, VisualizationRenderFn> = Object.fromEntries([
  ...Object.entries(threeSceneVisualizationModes).map(([id, mode]) =>
    [
      id,
      (context: RenderContext, descriptor: VisualizationDescriptor) =>
        renderThreeScene(context, mode, descriptor.accent),
    ] satisfies [string, VisualizationRenderFn]
  ),
  ...Object.entries(directVisualizationRenderers).map(([id, renderer]) =>
    [
      id,
      (context: RenderContext) => renderer(context),
    ] satisfies [string, VisualizationRenderFn]
  ),
]);

const gpuMonitorDependencies = { plotHistory, barChart, miniMeter, monitorGlyph };
const systemMonitorDependencies = { plotHistory, miniMeter, monitorGlyph };

interface NetworkMonitorRenderDependencies {
  plotHistory(values: number[], width: number, height: number, glyph: string): string;
  monitorGlyph(drive: VisualizationDrive, accent: Accent): string;
}

export function renderVisualization(context: RenderContext): PanelRender {
  const descriptor = visualizationMap.get(context.slot.visualizationId) ?? visualizations[0]!;
  const renderPanel = visualizationRenderers[context.slot.visualizationId] ??
    ((fallbackContext: RenderContext) => renderTelemetryRack(fallbackContext));
  const panel = renderPanel(context, descriptor);

  const enhancedPanel = applyNgePrimitiveScene(context, panel);
  const footerBase = enhancedPanel.footer || sourceFooter(context.sources);
  return {
    title: descriptor.name.toUpperCase(),
    accent: enhancedPanel.accent ?? descriptor.accent,
    severity: enhancedPanel.severity ?? "info",
    alert: enhancedPanel.alert ?? "",
    body: enhancedPanel.body,
    footer: footerBase,
    three: enhancedPanel.three,
  };
}

export function visualizationUsesThreeRenderer(visualizationId: string): boolean {
  return visualizationId in threeSceneVisualizationModes || visualizationId in ngePrimitiveSceneModes;
}

function renderNetworkMonitor(
  context: RenderContext,
  dependencies: NetworkMonitorRenderDependencies,
): PanelRender {
  const { system } = context;
  const width = Math.max(1, context.width);
  const height = Math.max(1, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 24));
  const alert = networkAlert(context);
  const network = busiestNetwork(system.networks);
  const isSurging = Boolean(network && network.rxRate + network.txRate > 125_000_000);

  return {
    body: networkMonitorLines(system, drive, width, height, dependencies).join("\n"),
    footer: networkFooter(system, drive, width),
    alert,
    accent: isSurging ? "amber" : "signal",
    severity: isSurging ? "warning" : "info",
  };
}

function networkMonitorLines(
  system: RenderContext["system"],
  drive: VisualizationDrive,
  width: number,
  height: number,
  dependencies: NetworkMonitorRenderDependencies,
): string[] {
  const lineBudget = Math.max(1, height);
  const chartWidth = Math.max(1, width);

  if (lineBudget <= 3 || width < 20) {
    const lines: string[] = [
      networkSummaryLine(system, width),
      compactNetworkTrace(system, chartWidth),
    ];
    appendNetworkInterfaceRows(lines, system, width, lineBudget - 2);
    return fitNetworkLines(lines, width, lineBudget);
  }

  if (lineBudget <= 6) {
    const interfaceRows = Math.min(system.networks.length, Math.max(0, lineBudget - 3));
    const chartHeight = Math.max(1, lineBudget - 1 - interfaceRows);
    const lines: string[] = [width >= 32 ? "RX/TX BUS" : "RX/TX"];
    appendSplitLines(
      lines,
      dependencies.plotHistory(
        combinedNetworkHistory(system),
        chartWidth,
        chartHeight,
        dependencies.monitorGlyph(drive, "signal"),
      ),
    );
    appendNetworkInterfaceRows(lines, system, width, interfaceRows);
    return fitNetworkLines(lines, width, lineBudget);
  }

  const interfaceRows = Math.min(system.networks.length, width >= 36 ? 2 : 1, Math.max(0, lineBudget - 6));
  const graphRows = Math.max(2, lineBudget - 2 - interfaceRows);
  const rxHeight = Math.max(1, Math.floor(graphRows / 2));
  const txHeight = Math.max(1, graphRows - rxHeight);

  const lines: string[] = [width >= 28 ? "RX BUS" : "RX"];
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.rxHistory, chartWidth, rxHeight, dependencies.monitorGlyph(drive, "signal")),
  );
  lines.push(width >= 28 ? "TX BUS" : "TX");
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.txHistory, chartWidth, txHeight, dependencies.monitorGlyph(drive, "amber")),
  );
  appendNetworkInterfaceRows(lines, system, width, interfaceRows);
  return fitNetworkLines(lines, width, lineBudget);
}

function networkSummaryLine(system: RenderContext["system"], width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NET IDLE";
  }

  const name = crop(network.name.toUpperCase(), width < 24 ? 5 : 10);
  if (width < 28) {
    return `NET ${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`;
  }
  return `NET ${name} RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function compactNetworkTrace(system: RenderContext["system"], width: number): string {
  let trace = "";
  for (let index = 0; index < width; index++) {
    const rxValue = sampleSeriesValue(system.rxHistory, index, width);
    const txValue = sampleSeriesValue(system.txHistory, index, width);
    const combined = Math.max(rxValue, txValue);
    if (combined >= 0.82) trace += "█";
    else if (rxValue >= 0.5 && txValue >= 0.5) trace += "▓";
    else if (rxValue >= txValue && rxValue >= 0.22) trace += "▄";
    else if (txValue > rxValue && txValue >= 0.22) trace += "▀";
    else trace += "·";
  }
  return trace;
}

function appendNetworkInterfaceRows(
  lines: string[],
  system: RenderContext["system"],
  width: number,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  if (system.networks.length === 0) {
    lines.push("NO ACTIVE INTERFACES");
    return;
  }
  const limit = Math.min(count, system.networks.length);
  for (let index = 0; index < limit; index++) {
    lines.push(networkInterfaceLine(system.networks[index], width));
  }
}

function networkInterfaceLine(
  network: RenderContext["system"]["networks"][number],
  width: number,
): string {
  const name = crop(network.name.toUpperCase(), width < 28 ? 6 : 10);
  if (width < 30) {
    return `${name} R${compactRate(network.rxRate)} T${compactRate(network.txRate)}`;
  }
  if (width < 48) {
    return `${name.padEnd(10, " ")} R ${formatRate(network.rxRate)}  T ${formatRate(network.txRate)}`;
  }
  const address = network.addresses[0] ? ` ${network.addresses[0]}` : "";
  return `${name.padEnd(10, " ")}${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function networkFooter(system: RenderContext["system"], drive: VisualizationDrive, width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NO ACTIVE INTERFACES";
  }
  const name = crop(network.name.toUpperCase(), width < 30 ? 6 : 10);
  if (width < 34) {
    return crop(`${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`, width);
  }
  const address = network.addresses[0] ?? "NO ADDRESS";
  return crop(
    `${name} ${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}  BURST ${
      (drive.volatility * 100).toFixed(0)
    }%`,
    width,
  );
}

function combinedNetworkHistory(system: RenderContext["system"]): number[] {
  const length = Math.max(system.rxHistory.length, system.txHistory.length, 1);
  const combined = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    combined[index] = Math.max(system.rxHistory[index] ?? 0, system.txHistory[index] ?? 0);
  }
  return combined;
}

function compactRate(value: number): string {
  return formatRate(value)
    .replace(/\s+/g, "")
    .replace("KiB/s", "K/s")
    .replace("MiB/s", "M/s")
    .replace("GiB/s", "G/s")
    .replace("TiB/s", "T/s");
}

function fitNetworkLines(lines: string[], width: number, height: number): string[] {
  const limit = Math.min(lines.length, Math.max(1, height));
  const fitted = new Array<string>(limit);
  for (let index = 0; index < limit; index++) {
    fitted[index] = crop(lines[index].trimEnd(), width);
  }
  return fitted;
}

function appendSplitLines(lines: string[], text: string): void {
  let start = 0;
  while (start <= text.length) {
    const next = text.indexOf("\n", start);
    if (next === -1) {
      lines.push(text.slice(start));
      return;
    }
    lines.push(text.slice(start, next));
    start = next + 1;
  }
}

function networkAlert(context: RenderContext) {
  const network = busiestNetwork(context.system.networks);
  if (!network) {
    return "";
  }
  const totalRate = network.rxRate + network.txRate;
  return totalRate > 125_000_000 ? `${network.name.toUpperCase()} SURGE ABOVE ${formatRate(totalRate)}` : "";
}

function busiestNetwork(networks: RenderContext["system"]["networks"]) {
  return networks.reduce<RenderContext["system"]["networks"][number] | undefined>((busiest, network) => {
    if (!busiest) {
      return network;
    }
    return network.rxRate + network.txRate > busiest.rxRate + busiest.txRate ? network : busiest;
  }, undefined);
}

function applyNgePrimitiveScene(context: RenderContext, panel: PanelRender): PanelRender {
  const visualizationId = context.slot.visualizationId;
  if (!neonDemoIds.has(visualizationId) || textOnlyNeonDemoIds.has(visualizationId)) {
    return panel;
  }

  if (panel.three) {
    return {
      ...panel,
      footer: appendThreeSceneFooter(panel.footer, panel.three.mode, context.width),
    };
  }

  const mode = ngePrimitiveSceneModes[visualizationId];
  if (!mode) return panel;
  const drive = buildVisualizationDrive(context, Math.max(32, context.width));

  return {
    ...panel,
    footer: appendThreeSceneFooter(panel.footer, mode, context.width),
    three: {
      mode,
      signal: driveThreeSignal(context, drive, mode),
    },
  };
}

function renderThreeScene(context: RenderContext, mode: ThreeSceneMode, accent: Accent): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(32, context.width));
  const severity = drive.hazard >= 0.88 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info";
  const headerAlert = sceneAlert(context.sources) || driveAlert(drive);

  return {
    body: renderThreeFallbackBody(context, drive, mode),
    footer: sourceDetailFooter(context.sources),
    alert: headerAlert,
    accent: severity === "alarm" ? "alarm" : severity === "warning" ? "amber" : accent,
    severity,
    three: {
      mode,
      signal: driveThreeSignal(context, drive, mode),
    },
  };
}

function renderWarningStack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = warningStackLines(context, drive, Math.max(1, context.height));

  return {
    body: lines.join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : "amber",
    severity: drive.hazard >= 0.88 ? "alarm" : "warning",
  };
}

function warningStackLines(context: RenderContext, drive: VisualizationDrive, limit: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < context.system.alerts.length && lines.length < limit; index += 1) {
    const alert = context.system.alerts[index]!;
    lines.push(`${alert.title}  ${alert.detail}`);
  }
  if (lines.length > 0) return lines;

  for (let index = 0; index < context.system.diagnostics.length && lines.length < limit; index += 1) {
    const diagnostic = context.system.diagnostics[index]!;
    if (diagnostic.status === "ok") continue;
    lines.push(`${diagnostic.source.toUpperCase()}  ${diagnostic.status.toUpperCase()}  ${diagnostic.detail}`);
  }
  if (lines.length > 0) return lines;

  const warnings = sourceWarnings(context.sources, drive);
  for (let index = 0; index < warnings.length && lines.length < limit; index += 1) {
    lines.push(warnings[index]!);
  }
  return lines;
}

function renderCounterBoard(context: RenderContext): PanelRender {
  const now = new Date();
  const primary = context.sources[0] ?? fallbackSource(context.phase);
  const drive = buildVisualizationDrive(context, 24);
  return {
    body: [
      `CLOCK      ${now.toLocaleTimeString("en-US", { hour12: false })}`,
      `COUNTDOWN  ${neonFormatCountdown(drive.phase)}`,
      `SEQUENCE   ${String(drive.phase).padStart(6, "0")}`,
      `PRIMARY    ${primary.name.toUpperCase()}`,
      `AMPLITUDE  ${(drive.current * 100).toFixed(1).padStart(5, " ")}%`,
      `VELOCITY   ${(Math.abs(drive.slope) * 100).toFixed(1).padStart(5, " ")}%`,
      `VECTOR     ${sourceNameMatrix(context.sources)}`,
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SOURCE DRIVE MAXIMUM" : drive.divergence >= 0.64 ? "VECTOR SEPARATION" : "",
    accent: drive.hazard >= 0.92 ? "alarm" : primary.accent,
    severity: drive.hazard >= 0.92 ? "alarm" : drive.divergence >= 0.64 ? "warning" : "info",
  };
}

function renderProfileCard(context: RenderContext): PanelRender {
  const primary = context.sources[0] ?? fallbackSource(context.phase);
  const secondary = context.sources[1];
  const drive = buildVisualizationDrive(context, 24);
  const confidence = Math.round(drive.current * 100);
  return {
    body: [
      "SIGNAL PROFILE",
      `PRIMARY   ${primary.name.toUpperCase()}`,
      `SECONDARY ${secondary ? secondary.name.toUpperCase() : "NONE"}`,
      `SYNC      ${confidence.toString().padStart(3, " ")}%`,
      `DELTA     ${(drive.divergence * 100).toFixed(0).padStart(3, " ")}%`,
      `STATUS    ${drive.hazard >= 0.86 ? "OVERTAKEN" : confidence >= 60 ? "LIVE" : "STABLE"}`,
      `BIND      ${context.slot.id.toUpperCase()}`,
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: confidence >= 90 ? "SYNC THRESHOLD EXCEEDED" : drive.divergence >= 0.62 ? "CHANNEL SPLIT DETECTED" : "",
    accent: confidence >= 90 ? "alarm" : "violet",
    severity: confidence >= 90 ? "alarm" : drive.divergence >= 0.62 ? "warning" : confidence >= 70 ? "warning" : "info",
  };
}

function renderLiveFeed(context: RenderContext): PanelRender {
  const width = Math.max(16, context.width);
  const height = Math.max(6, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 32));
  const noise = liveFeed(width, height, drive);
  return {
    body: noise,
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "alarm",
    severity: drive.hazard >= 0.88 ? "alarm" : "warning",
  };
}

function renderEventLog(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = eventLogLines(context, drive, Math.max(1, context.height));

  return {
    body: lines.join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "amber" : "signal",
    severity: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "warning" : "info",
  };
}

function eventLogLines(context: RenderContext, drive: VisualizationDrive, limit: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < context.system.alerts.length && lines.length < limit; index += 1) {
    const alert = context.system.alerts[index]!;
    lines.push(`${String(223229 + index * 17)}  ${alert.title} ${alert.detail}`);
  }
  for (let index = 0; index < context.sources.length && lines.length < limit; index += 1) {
    const source = context.sources[index]!;
    const detailLimit = Math.min(2, source.detailLines.length);
    for (let detailIndex = 0; detailIndex < detailLimit && lines.length < limit; detailIndex += 1) {
      const line = source.detailLines[detailIndex]!;
      lines.push(`${String(223500 + index * 31 + detailIndex * 7)}  ${source.name.toUpperCase()} ${line}`);
    }
  }
  if (lines.length < limit) {
    lines.push(`${String(224100 + Math.round(drive.phase % 800))}  VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`);
  }
  if (lines.length < limit) {
    lines.push(
      `${String(224280 + Math.round(drive.divergence * 100))}  PHASE SLEW ${(drive.volatility * 100).toFixed(0)}%`,
    );
  }
  return lines;
}

function renderChannelMatrix(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: channelMatrix(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : "phosphor",
    severity: drive.hazard >= 0.88 ? "alarm" : drive.volatility >= 0.58 ? "warning" : "info",
  };
}

function renderTelemetryRack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: telemetryRack(Math.max(12, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : hottestAccent(context.sources),
    severity: drive.hazard >= 0.88 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info",
  };
}

function renderBiosignalStrip(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: biosignalStrip(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "phosphor",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.volatility >= 0.54 ? "warning" : "info",
  };
}

function renderHarmonicGraph(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: harmonicField(Math.max(18, context.width), Math.max(4, context.height), drive, monitorGlyph(drive, "violet")),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "violet",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info",
  };
}

function renderPsychograph(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: psychograph(Math.max(18, context.width), Math.max(4, context.height), drive, monitorGlyph(drive, "amber")),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderFieldRing(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: circularField(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "signal",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderHeatmap(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: heatmap(Math.max(16, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderMagiBoard(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const balthasar = drive.current >= 0.84 ? "OVERRIDE" : drive.current >= 0.62 ? "REVIEW" : "HOLD";
  const melchior = drive.divergence >= 0.62 ? "REJECT" : drive.hazard >= 0.82 ? "CAUTION" : "TRACK";
  const casper = drive.volatility >= 0.54 ? "REROUTE" : drive.slope >= 0.18 ? "PURSUE" : "STABLE";
  return {
    body: [
      "╭──── BALTHASAR-2 ────╮",
      `│ ${balthasar.padEnd(18, " ")}│`,
      `│ ${casper.padEnd(8, " ")} / ${melchior.padEnd(7, " ")} │`,
      "╰── CASPER-3 ── MELCHIOR-1 ─╯",
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.88 ? "MAGI CONFLICT STATE" : drive.divergence >= 0.62 ? "TRIPLE-VOTE SPLIT" : "",
    accent: drive.hazard >= 0.88 ? "alarm" : drive.divergence >= 0.62 ? "amber" : "phosphor",
    severity: drive.hazard >= 0.88 ? "alarm" : drive.divergence >= 0.62 ? "warning" : "info",
  };
}

function renderRouteBoard(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: routeBoard(Math.max(14, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "alarm",
    severity: drive.hazard >= 0.9 ? "alarm" : drive.divergence >= 0.58 ? "warning" : "info",
  };
}

function renderGateStatus(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  return {
    body: [
      drive.current >= 0.86 ? "LOCKED    DRIVE CHANNEL HELD CLOSED" : "LOCKED    WAITING FOR PERMISSION KEY",
      drive.divergence >= 0.58 ? "PURGE     OUTER GATE FORCE-CYCLE" : "OPEN      OUTER AND LOCK GATE IMMEDIATELY",
      drive.hazard >= 0.92 ? "REJECT    EMERGENCY DIRECTION REFUSAL" : "REFUSED   ENTRY PLUG DIRECTION CHECK",
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "DIRECTION REFUSAL STATE" : drive.divergence >= 0.58 ? "GATE RECONFIGURATION" : "",
    accent: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.75 ? "amber" : "signal",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.75 ? "warning" : "info",
  };
}

function renderTacticalMap(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: tacticalMap(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "phosphor",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderNetworkTopology(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: networkTopology(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderComponentIndex(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: componentIndex(
      Math.max(18, context.width),
      Math.max(4, context.height),
      drive,
      neonDemoTitles,
    ),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SUITE SATURATION" : "",
    accent: "amber",
    severity: drive.hazard >= 0.92 ? "warning" : "info",
  };
}
