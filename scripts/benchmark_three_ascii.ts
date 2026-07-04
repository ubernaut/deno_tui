import { PerspectiveCamera, Scene } from "npm:three@0.183.2";
import {
  BenchmarkCase,
  buildThreeAsciiAnsiGrid,
  Canvas,
  emptyStyle,
  MemoryCanvasSink,
  renderFrameRow,
  ThreeAsciiAnsiGridAssembler,
  type ThreeAsciiGridRenderer,
  ThreeAsciiObject,
  ThreeAsciiRenderer,
} from "../mod.ts";
import { compactMappedRgbaRows } from "../src/three_ascii/headless_canvas.ts";
import { createThreeAsciiReadbackLayout, ThreeAsciiReadbackViewCache } from "../src/three_ascii/readback.ts";

const threeAsciiColumns = 96;
const threeAsciiRows = 40;
const threeAsciiCellCount = threeAsciiColumns * threeAsciiRows;
const threeAsciiFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSolidFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiSolidEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSolidColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPatternFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiPatternEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPatternColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPartialFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiPartialEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPartialColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSparseFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiSparseEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSparseColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackFillSource = new Float32Array(threeAsciiCellCount);
const threeAsciiReadbackEdgeSource = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackColorSource = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackFillCpu = new Float32Array(threeAsciiCellCount);
const threeAsciiReadbackEdgeCpu = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackColorCpu = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackLayout = createThreeAsciiReadbackLayout({
  fillByteLength: threeAsciiReadbackFillSource.byteLength,
  edgeByteLength: threeAsciiReadbackEdgeSource.byteLength,
  colorByteLength: threeAsciiReadbackColorSource.byteLength,
  includeEdges: true,
});
const threeAsciiReadbackPacked = new ArrayBuffer(threeAsciiReadbackLayout.byteLength);
const threeAsciiReadbackPackedFloats = new Float32Array(threeAsciiReadbackPacked);
const threeAsciiReadbackViewCache = new ThreeAsciiReadbackViewCache();
const threeAsciiGridAssembler = new ThreeAsciiAnsiGridAssembler({ reuseGrid: true });
const threeAsciiImageWidth = threeAsciiColumns * 8;
const threeAsciiImageHeight = threeAsciiRows * 8;
const threeAsciiImageBytesPerRow = threeAsciiImageWidth * 4;
const threeAsciiImageSource = new Uint8Array(threeAsciiImageBytesPerRow * threeAsciiImageHeight);
const threeAsciiImageTarget = new Uint8Array(threeAsciiImageBytesPerRow * threeAsciiImageHeight);
const threeAsciiUniformRenderer = new ThreeAsciiRenderer({
  scene: new Scene(),
  camera: new PerspectiveCamera(),
  columns: threeAsciiColumns,
  rows: threeAsciiRows,
});
let threeAsciiUniformWrites = 0;
const threeAsciiUniformInternals = threeAsciiUniformRenderer as unknown as {
  device: { queue: { writeBuffer: () => void } };
  paramsBuffer: object;
  writeUniforms(effectState: unknown): void;
};
threeAsciiUniformInternals.device = { queue: { writeBuffer: () => threeAsciiUniformWrites += 1 } };
threeAsciiUniformInternals.paramsBuffer = {};
const threeAsciiUniformEffectState = {
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
let threeAsciiReadbackCursor = 0;
let threeAsciiReadbackChecksum = 0;

const threeAsciiPatternPalette = [
  [0.95, 0.12, 0.18],
  [0.12, 0.9, 0.35],
  [0.12, 0.42, 0.96],
  [0.95, 0.78, 0.18],
] as const;

for (let index = 0; index < threeAsciiCellCount; index += 1) {
  const x = index % threeAsciiColumns;
  const y = Math.floor(index / threeAsciiColumns);
  threeAsciiFillGlyphs[index] = 5 + ((x + y) % 10);
  const edgeOffset = index * 4;
  threeAsciiEdgeGlyphs[edgeOffset] = (x * 3 + y) % 5;
  threeAsciiEdgeGlyphs[edgeOffset + 1] = (x % 6) + 2;
  threeAsciiEdgeGlyphs[edgeOffset + 2] = 24;
  threeAsciiEdgeGlyphs[edgeOffset + 3] = y % 4;
  const colorOffset = index * 4;
  threeAsciiColors[colorOffset] = (x % 16) / 15;
  threeAsciiColors[colorOffset + 1] = (y % 12) / 11;
  threeAsciiColors[colorOffset + 2] = ((x + y) % 20) / 19;
  threeAsciiColors[colorOffset + 3] = 1;

  threeAsciiSolidFillGlyphs[index] = 14;
  threeAsciiSolidColors[colorOffset] = 0.18;
  threeAsciiSolidColors[colorOffset + 1] = 0.9;
  threeAsciiSolidColors[colorOffset + 2] = 0.72;
  threeAsciiSolidColors[colorOffset + 3] = 1;
  if (x === y || x === threeAsciiColumns - y - 1 || x % 24 === 0) {
    threeAsciiSolidEdgeGlyphs[edgeOffset] = 1 + (x % 4);
    threeAsciiSolidEdgeGlyphs[edgeOffset + 1] = 18;
    threeAsciiSolidEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiSolidEdgeGlyphs[edgeOffset + 3] = 2;
  }

  threeAsciiPatternFillGlyphs[index] = 14;
  const patternColor = threeAsciiPatternPalette[(x * 3 + y * 5) % threeAsciiPatternPalette.length];
  threeAsciiPatternColors[colorOffset] = patternColor[0];
  threeAsciiPatternColors[colorOffset + 1] = patternColor[1];
  threeAsciiPatternColors[colorOffset + 2] = patternColor[2];
  threeAsciiPatternColors[colorOffset + 3] = 1;
  if ((x + y) % 19 === 0) {
    threeAsciiPatternEdgeGlyphs[edgeOffset] = 1 + (x % 4);
    threeAsciiPatternEdgeGlyphs[edgeOffset + 1] = 20;
    threeAsciiPatternEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiPatternEdgeGlyphs[edgeOffset + 3] = 1;
  }

  threeAsciiPartialFillGlyphs[index] = 8 + ((x + y) % 6);
  const partialColor = threeAsciiPatternPalette[(x + y * 2) % threeAsciiPatternPalette.length];
  threeAsciiPartialColors[colorOffset] = partialColor[0];
  threeAsciiPartialColors[colorOffset + 1] = partialColor[1];
  threeAsciiPartialColors[colorOffset + 2] = partialColor[2];
  threeAsciiPartialColors[colorOffset + 3] = 1;
  if ((x * 2 + y) % 17 === 0) {
    threeAsciiPartialEdgeGlyphs[edgeOffset] = 1 + (y % 4);
    threeAsciiPartialEdgeGlyphs[edgeOffset + 1] = 14;
    threeAsciiPartialEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiPartialEdgeGlyphs[edgeOffset + 3] = 2;
  }

  threeAsciiSparseColors[colorOffset] = (x % 16) / 15;
  threeAsciiSparseColors[colorOffset + 1] = (y % 12) / 11;
  threeAsciiSparseColors[colorOffset + 2] = ((x + y) % 20) / 19;
  threeAsciiSparseColors[colorOffset + 3] = 1;
  if ((x + y) % 7 === 0 || (x > 42 && x < 54 && y > 12 && y < 28)) {
    threeAsciiSparseFillGlyphs[index] = 5 + ((x + y) % 10);
  }
  if ((x * 5 + y * 3) % 23 === 0) {
    threeAsciiSparseEdgeGlyphs[edgeOffset] = (x + y) % 5;
    threeAsciiSparseEdgeGlyphs[edgeOffset + 1] = (x % 6) + 3;
    threeAsciiSparseEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiSparseEdgeGlyphs[edgeOffset + 3] = y % 4;
  }
}

threeAsciiReadbackFillSource.set(threeAsciiFillGlyphs);
threeAsciiReadbackEdgeSource.set(threeAsciiEdgeGlyphs);
threeAsciiReadbackColorSource.set(threeAsciiColors);
threeAsciiReadbackPackedFloats.set(
  threeAsciiReadbackFillSource,
  threeAsciiReadbackLayout.fillOffset / Float32Array.BYTES_PER_ELEMENT,
);
threeAsciiReadbackPackedFloats.set(
  threeAsciiReadbackEdgeSource,
  threeAsciiReadbackLayout.edgeOffset! / Float32Array.BYTES_PER_ELEMENT,
);
threeAsciiReadbackPackedFloats.set(
  threeAsciiReadbackColorSource,
  threeAsciiReadbackLayout.colorOffset / Float32Array.BYTES_PER_ELEMENT,
);
for (let index = 0; index < threeAsciiImageSource.length; index += 1) {
  threeAsciiImageSource[index] = (index * 17 + (index >>> 7)) & 0xff;
}

interface ThreeAsciiDiffQueueTarget {
  queueChangedGridCells(
    grid: string[][],
    rectangle: { column: number; row: number; width: number; height: number },
  ): boolean;
}

const threeAsciiDiffRectangle = { column: 0, row: 0, width: 96, height: 40 };
const threeAsciiDiffGridA = createThreeAsciiDiffGrid(threeAsciiDiffRectangle.width, threeAsciiDiffRectangle.height, 0);
const threeAsciiDiffGridB = createThreeAsciiDiffGrid(threeAsciiDiffRectangle.width, threeAsciiDiffRectangle.height, 1);
const threeAsciiDiffCanvas = new Canvas({
  sink: new MemoryCanvasSink(),
  size: { columns: threeAsciiDiffRectangle.width, rows: threeAsciiDiffRectangle.height },
});
const threeAsciiDiffObject = new ThreeAsciiObject({
  canvas: threeAsciiDiffCanvas,
  rectangle: threeAsciiDiffRectangle,
  scene: {} as never,
  camera: {} as never,
  style: emptyStyle,
  zIndex: 1,
  rendererFactory: () => createNoopThreeAsciiRenderer(),
});
const threeAsciiDiffQueueTarget = threeAsciiDiffObject as unknown as ThreeAsciiDiffQueueTarget;

function assertThreeAsciiGridDimensions(grid: string[][], errorMessage: string): void {
  if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
    throw new Error(errorMessage);
  }
}

function runThreeAsciiReadbackCopyWorkload(): void {
  threeAsciiReadbackFillCpu.set(threeAsciiReadbackFillSource);
  threeAsciiReadbackEdgeCpu.set(threeAsciiReadbackEdgeSource);
  threeAsciiReadbackColorCpu.set(threeAsciiReadbackColorSource);
  const views = threeAsciiReadbackViewCache.resolve(threeAsciiReadbackPacked, threeAsciiReadbackLayout);

  const fillIndex = threeAsciiReadbackCursor % threeAsciiReadbackFillCpu.length;
  const edgeIndex = (threeAsciiReadbackCursor * 3) % threeAsciiReadbackEdgeCpu.length;
  const colorIndex = (threeAsciiReadbackCursor * 5) % threeAsciiReadbackColorCpu.length;
  threeAsciiReadbackCursor = (threeAsciiReadbackCursor + 17) % threeAsciiReadbackColorCpu.length;
  threeAsciiReadbackChecksum = (
    threeAsciiReadbackChecksum +
    threeAsciiReadbackFillCpu[fillIndex] +
    threeAsciiReadbackEdgeCpu[edgeIndex] +
    threeAsciiReadbackColorCpu[colorIndex] +
    views.fillGlyphs[fillIndex] +
    views.edgeGlyphs![edgeIndex] +
    views.colors[colorIndex]
  ) % 1_000_000;

  if (!Number.isFinite(threeAsciiReadbackChecksum)) {
    throw new Error("three Ascii readback copy produced invalid data");
  }
}

function runThreeAsciiImageCompactionWorkload(): void {
  const result = compactMappedRgbaRows(
    threeAsciiImageSource,
    threeAsciiImageWidth,
    threeAsciiImageHeight,
    threeAsciiImageBytesPerRow,
    threeAsciiImageTarget,
  );
  const index = (threeAsciiReadbackCursor * 13) % result.length;
  threeAsciiReadbackChecksum = (threeAsciiReadbackChecksum + result[index]!) % 1_000_000;
  if (result !== threeAsciiImageTarget || !Number.isFinite(threeAsciiReadbackChecksum)) {
    throw new Error("three Ascii image compaction produced invalid data");
  }
}

function runThreeAsciiUniformCleanWorkload(): void {
  if (threeAsciiUniformWrites === 0) {
    threeAsciiUniformInternals.writeUniforms(threeAsciiUniformEffectState);
  }
  const before = threeAsciiUniformWrites;
  for (let index = 0; index < 1_000; index += 1) {
    threeAsciiUniformInternals.writeUniforms(threeAsciiUniformEffectState);
  }
  if (threeAsciiUniformWrites !== before) {
    throw new Error("clean Three ASCII uniforms were uploaded again");
  }
}

function runThreeAsciiDiffQueueWorkload(): void {
  threeAsciiDiffQueueTarget.queueChangedGridCells(threeAsciiDiffGridA, threeAsciiDiffRectangle);
  clearThreeAsciiDiffQueue();
  for (let step = 0; step < 64; step += 1) {
    threeAsciiDiffQueueTarget.queueChangedGridCells(
      step % 2 === 0 ? threeAsciiDiffGridB : threeAsciiDiffGridA,
      threeAsciiDiffRectangle,
    );
    clearThreeAsciiDiffQueue();
  }
}

function createThreeAsciiDiffGrid(columns: number, rows: number, phase: number): string[][] {
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    const outputRow = new Array<string>(columns);
    for (let column = 0; column < columns; column += 1) {
      const active = (row * 17 + column * 7 + phase) % 23 === 0;
      outputRow[column] = active ? "\x1b[38;2;180;255;120m█\x1b[0m" : " ";
    }
    grid[row] = outputRow;
  }
  return grid;
}

function clearThreeAsciiDiffQueue(): void {
  for (let row = 0; row < threeAsciiDiffObject.rerenderCells.length; row += 1) {
    threeAsciiDiffObject.rerenderCells[row]?.clear();
  }
  for (let row = 0; row < threeAsciiDiffObject.rerenderRanges.length; row += 1) {
    const ranges = threeAsciiDiffObject.rerenderRanges[row];
    if (ranges) ranges.length = 0;
  }
}

function createNoopThreeAsciiRenderer(): ThreeAsciiGridRenderer {
  return {
    scene: {} as never,
    camera: {} as never,
    setSize: () => {},
    setEffectOptions: () => {},
    getTerminalEdgeBias: () => 1,
    setTerminalEdgeBias: () => {},
    getTerminalGlyphStyle: () => "blocks",
    setTerminalGlyphStyle: () => {},
    renderToAnsiGrid: () => Promise.resolve([]),
    destroy: () => {},
  };
}

export const threeAsciiBenchmarkCases: BenchmarkCase[] = [
  {
    name: "render/three-ascii-ansi-grid-96x40",
    category: "render",
    description: "CPU-assemble a 96x40 truecolor ANSI grid from Three ASCII readback buffers.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly"],
    iterations: 150,
    maxAverageMs: 12,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiFillGlyphs,
        edgeGlyphs: threeAsciiEdgeGlyphs,
        colors: threeAsciiColors,
        terminalGlyphStyle: "mixed",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-solid-96x40",
    category: "render",
    description: "CPU-assemble a repeated-color block-heavy Three ASCII grid with cached ANSI cell strings.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 200,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSolidFillGlyphs,
        edgeGlyphs: threeAsciiSolidEdgeGlyphs,
        colors: threeAsciiSolidColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "solid three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-block-runs-96x40",
    category: "render",
    description: "CPU-assemble dense same-color block-mode rows using visible-cell range fills.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "blocks", "runs"],
    iterations: 250,
    maxAverageMs: 5,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSolidFillGlyphs,
        colors: threeAsciiSolidColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "block-run three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-partial-block-96x40",
    category: "render",
    description: "CPU-assemble a partial block-mode Three ASCII grid with recurring mixed foreground colors.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache", "blocks"],
    iterations: 250,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPartialFillGlyphs,
        edgeGlyphs: threeAsciiPartialEdgeGlyphs,
        colors: threeAsciiPartialColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x020014,
      });
      assertThreeAsciiGridDimensions(grid, "partial block three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-pattern-96x40",
    category: "render",
    description: "CPU-assemble a patterned block-mode Three ASCII grid with recurring non-adjacent cell strings.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 200,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        edgeGlyphs: threeAsciiPatternEdgeGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "pattern three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-fill-only-96x40",
    category: "render",
    description: "CPU-assemble a fill-only Three ASCII ANSI grid without edge readback buffers.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "fill"],
    iterations: 250,
    maxAverageMs: 5,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "fill-only three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-glyph-cache-96x40",
    category: "render",
    description: "CPU-assemble a glyph-mode Three ASCII grid while reusing adjacent ANSI cell strings.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache", "glyphs"],
    iterations: 200,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        edgeGlyphs: threeAsciiPatternEdgeGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "glyphs",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "glyph-cache three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-warm-cache-96x40",
    category: "render",
    description: "CPU-assemble recurring Three ASCII frames while reusing ANSI conversion, cell, and grid-row caches.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 250,
    maxAverageMs: 5,
    run: () => {
      const grid = threeAsciiGridAssembler.build({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        edgeGlyphs: threeAsciiPatternEdgeGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "warm-cache three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-ansi-grid-sparse-96x40",
    category: "render",
    description: "CPU-assemble a sparse 96x40 truecolor ANSI grid while skipping proven blank cells.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "sparse"],
    iterations: 200,
    maxAverageMs: 8,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSparseFillGlyphs,
        edgeGlyphs: threeAsciiSparseEdgeGlyphs,
        colors: threeAsciiSparseColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      assertThreeAsciiGridDimensions(grid, "sparse three Ascii grid dimensions changed");
    },
  },
  {
    name: "render/three-ascii-terminal-row-sparse-96x40",
    category: "render",
    description: "Assemble terminal row output for a sparse block-mode Three ASCII frame with styled-run compaction.",
    tags: ["render", "three", "ascii", "ansi", "terminal", "sparse"],
    iterations: 200,
    maxAverageMs: 8,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSparseFillGlyphs,
        edgeGlyphs: threeAsciiSparseEdgeGlyphs,
        colors: threeAsciiSparseColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      let bytes = 0;
      for (const row of grid) {
        bytes += renderFrameRow(row, threeAsciiColumns).length;
      }
      if (bytes <= threeAsciiRows * threeAsciiColumns) {
        throw new Error("terminal row output did not include ANSI styling");
      }
    },
  },
  {
    name: "render/three-ascii-readback-copy-96x40",
    category: "render",
    description: "Copy a 96x40 Three Ascii fill, edge, and color readback payload into CPU-visible buffers.",
    tags: ["render", "three", "ascii", "readback", "copy"],
    iterations: 1_000,
    maxAverageMs: 2,
    run: runThreeAsciiReadbackCopyWorkload,
  },
  {
    name: "render/three-ascii-image-compact-768x320",
    category: "render",
    description: "Compact a tightly packed Three ASCII RGBA image readback for Kitty graphics output.",
    tags: ["render", "three", "ascii", "readback", "image", "kitty", "copy"],
    iterations: 500,
    maxAverageMs: 2,
    run: runThreeAsciiImageCompactionWorkload,
  },
  {
    name: "render/three-ascii-uniform-clean-1k",
    category: "render",
    description: "Skip clean Three ASCII compute uniform uploads across 1000 unchanged frames.",
    tags: ["render", "three", "ascii", "uniform", "gpu", "cache"],
    iterations: 500,
    maxAverageMs: 2,
    run: runThreeAsciiUniformCleanWorkload,
  },
  {
    name: "render/three-ascii-frame-diff-96x40",
    category: "render",
    description: "Diff recurring 96x40 Three ASCII terminal grids and queue only changed canvas cells.",
    tags: ["render", "three", "ascii", "canvas", "diff"],
    iterations: 200,
    maxAverageMs: 10,
    run: runThreeAsciiDiffQueueWorkload,
  },
];
