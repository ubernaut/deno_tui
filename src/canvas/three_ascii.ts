import { emptyStyle } from "../theme.ts";
import { DrawObject, type DrawObjectOptions } from "./draw_object.ts";
import { Signal, type SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import type { Rectangle } from "../types.ts";
import type { DirtyRowSegment } from "./dirty_region.ts";
import type { Camera, Scene } from "three";
import type { AcerolaAsciiNodeOptions } from "../three_ascii/AcerolaAsciiNode.ts";
import type { TerminalGlyphStyle } from "../three_ascii/glyphs.ts";
import { queueRerenderCellInto, queueRerenderRangeInto, queueRerenderRangeOnlyInto } from "./rerender_queue.ts";
import {
  type ThreeAsciiImageFrame,
  ThreeAsciiRenderer,
  type ThreeAsciiRendererOptions,
  type ThreeAsciiRenderFrame,
  type ThreeAsciiRenderFrameOptions,
} from "../three_ascii/renderer.ts";
import { nextFrameDelay } from "../runtime/render_loop.ts";

/** Public interface describing a three Ascii Grid Renderer. */
export interface ThreeAsciiGridRenderer {
  readonly scene: Scene;
  readonly camera: Camera;
  setSize(columns: number, rows: number): void;
  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void;
  getTerminalEdgeBias(): number;
  setTerminalEdgeBias(value: number): void;
  getTerminalGlyphStyle(): TerminalGlyphStyle;
  setTerminalGlyphStyle(value: TerminalGlyphStyle): void;
  renderToAnsiGrid(deltaTime?: number, onFrame?: (deltaTime: number) => void | Promise<void>): Promise<string[][]>;
  renderToImageFrame?(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<ThreeAsciiImageFrame>;
  renderFrame?(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options?: ThreeAsciiRenderFrameOptions,
  ): Promise<ThreeAsciiRenderFrame>;
  destroy(): void;
}

/** Public type alias for a three Ascii Renderer Factory. */
export type ThreeAsciiRendererFactory = (options: ThreeAsciiRendererOptions) => ThreeAsciiGridRenderer;

/** Options for configuring three Ascii Object. */
export interface ThreeAsciiObjectOptions extends DrawObjectOptions {
  rectangle: Rectangle | SignalOfObject<Rectangle>;
  scene: Scene;
  camera: Camera;
  frameInterval?: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
  readbackStrategy?: ThreeAsciiRendererOptions["readbackStrategy"];
  deferredReadbackSlots?: number;
  deferredReadbackMaxStaleFrames?: number;
  effect?: AcerolaAsciiNodeOptions;
  onFrame?: (deltaTime: number) => void | Promise<void>;
  rendererFactory?: ThreeAsciiRendererFactory;
}

/** Public class implementing a three Ascii Object. */
export class ThreeAsciiObject extends DrawObject<"three_ascii"> {
  override rectangle: Signal<Rectangle>;
  renderer: ThreeAsciiGridRenderer;
  frameInterval: number;
  onFrame?: (deltaTime: number) => void | Promise<void>;
  grid: string[][] = [];
  readonly rerenderRanges: DirtyRowSegment[][] = [];

  private lastFrameTime = performance.now();
  private rendering = false;
  private running = false;
  private destroyPending = false;
  private syncPending = false;
  private failed = false;
  private frameGeneration = 0;
  private frameTimer?: ReturnType<typeof setTimeout>;
  private pendingEffectOptions?: Partial<AcerolaAsciiNodeOptions>;
  private pendingTerminalEdgeBias?: number;
  private pendingTerminalGlyphStyle?: TerminalGlyphStyle;
  private readonly previousGrid = createThreeAsciiGridDiffState();
  private lastQueuedGridRevision: number | undefined;
  private lastQueuedGridKey = "";
  private rendererColumns: number;
  private rendererRows: number;

  constructor(options: ThreeAsciiObjectOptions) {
    super("three_ascii", { ...options, style: emptyStyle });

    this.rectangle = signalify(options.rectangle, { deepObserve: true });
    const rendererFactory = options.rendererFactory ?? ((rendererOptions) => new ThreeAsciiRenderer(rendererOptions));
    const initialRectangle = options.rectangle instanceof Signal ? options.rectangle.peek() : options.rectangle;
    this.rendererColumns = initialRectangle.width;
    this.rendererRows = initialRectangle.height;
    this.renderer = rendererFactory({
      scene: options.scene,
      camera: options.camera,
      columns: this.rendererColumns,
      rows: this.rendererRows,
      pixelAspectRatio: options.pixelAspectRatio,
      terminalEdgeBias: options.terminalEdgeBias,
      terminalGlyphStyle: options.terminalGlyphStyle,
      readbackStrategy: options.readbackStrategy ?? "deferred",
      deferredReadbackSlots: options.deferredReadbackSlots,
      deferredReadbackMaxStaleFrames: options.deferredReadbackMaxStaleFrames,
      effect: options.effect,
    });
    this.frameInterval = options.frameInterval ?? 1000 / 24;
    this.onFrame = options.onFrame;
  }

  override draw(): void {
    this.invalidateFrame();
    this.rectangle.subscribe(this.handleResize);
    this.running = true;
    this.failed = false;
    this.destroyPending = false;
    this.syncPending = false;
    this.syncRendererSize(this.rectangle.peek());
    super.draw();
    this.showStatusGrid("INITIALIZING", "ASCII RENDERER STARTING");
    queueMicrotask(() => void this.renderLoop());
  }

  override erase(): void {
    this.invalidateFrame();
    this.running = false;
    this.syncPending = false;
    if (this.frameTimer !== undefined) {
      clearTimeout(this.frameTimer);
      this.frameTimer = undefined;
    }
    this.rectangle.unsubscribe(this.handleResize);
    this.grid = [];
    this.clearPreviousGridCells();
    if (this.rendering) {
      this.destroyPending = true;
    } else {
      this.renderer.destroy();
    }
    super.erase();
  }

  override rerender(): void {
    const { frameBuffer, rerenderQueue, rerenderRanges } = this.canvas;
    const rectangle = this.rectangle.peek();
    const { columns, rows } = this.canvas.size.peek();
    const viewRectangle = this.view.peek()?.rectangle?.peek();

    let rowLimit = Math.min(rows, rectangle.row + rectangle.height);
    let columnLimit = Math.min(columns, rectangle.column + rectangle.width);

    if (viewRectangle) {
      rowLimit = Math.min(rowLimit, viewRectangle.row + viewRectangle.height);
      columnLimit = Math.min(columnLimit, viewRectangle.column + viewRectangle.width);
    }

    for (let row = rectangle.row; row < rowLimit; row += 1) {
      const rerenderColumns = this.rerenderCells[row];
      const ranges = this.rerenderRanges[row];
      if (!rerenderColumns?.size && !ranges?.length) continue;

      const outputRow = this.grid[row - rectangle.row];
      const frameRow = frameBuffer[row] ??= [];
      const omitColumns = this.omitCells[row];

      if (ranges?.length) {
        const hasOmissions = !!omitColumns?.size;
        const queueRanges = hasOmissions ? undefined : rerenderRanges[row] ??= [];
        const fallbackQueueRow = hasOmissions ? rerenderQueue[row] ??= new Set<number>() : undefined;
        applyThreeAsciiRerenderRanges({
          frameRow,
          outputRow,
          ranges,
          row,
          rectangleColumn: rectangle.column,
          columnLimit,
          omitColumns,
          directRanges: queueRanges,
          fallbackCells: fallbackQueueRow,
        });

        ranges.length = 0;
      }

      if (!rerenderColumns?.size) continue;
      const queueRow = rerenderQueue[row] ??= new Set();
      applyThreeAsciiRerenderCells({
        frameRow,
        outputRow,
        columns: rerenderColumns,
        rectangleColumn: rectangle.column,
        columnLimit,
        omitColumns,
        queueCells: queueRow,
      });
      rerenderColumns.clear();
    }
  }

  private readonly handleResize = (rectangle: Rectangle) => {
    if (this.rendering) {
      this.invalidateFrame();
      this.running = false;
      this.syncPending = true;
      this.showStatusGrid("RESIZING", "ASCII RENDERER RESIZING");
      this.moved = true;
      this.updated = false;
      this.canvas.updateObjects.push(this);
      return;
    }
    const resized = this.syncRendererSize(rectangle);
    if (resized || this.failed || !this.running) {
      this.showStatusGrid(
        this.failed ? "GPU BACKEND UNAVAILABLE" : "RESIZING",
        this.failed ? "ASCII RENDERER OFFLINE" : "ASCII RENDERER RESIZING",
      );
    }
    this.moved = true;
    this.updated = false;
    this.canvas.updateObjects.push(this);
  };

  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void {
    if (this.rendering) {
      this.invalidateFrame();
      this.pendingEffectOptions = { ...this.pendingEffectOptions, ...options };
      this.running = false;
      this.syncPending = true;
      return;
    }
    this.renderer.setEffectOptions(options);
  }

  getTerminalEdgeBias(): number {
    return this.renderer.getTerminalEdgeBias();
  }

  setTerminalEdgeBias(value: number): void {
    if (this.rendering) {
      this.invalidateFrame();
      this.pendingTerminalEdgeBias = value;
      this.running = false;
      this.syncPending = true;
      return;
    }
    this.renderer.setTerminalEdgeBias(value);
  }

  getTerminalGlyphStyle(): TerminalGlyphStyle {
    return this.renderer.getTerminalGlyphStyle();
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    if (this.rendering) {
      this.invalidateFrame();
      this.pendingTerminalGlyphStyle = value;
      this.running = false;
      this.syncPending = true;
      return;
    }
    this.renderer.setTerminalGlyphStyle(value);
  }

  isOperational(): boolean {
    return !this.failed;
  }

  private async renderLoop(): Promise<void> {
    if (!this.running || this.rendering) return;

    const renderer = this.renderer;
    const frameGeneration = this.frameGeneration;
    this.rendering = true;
    const frameStartedAt = performance.now();

    try {
      const rectangle = this.rectangle.peek();
      if (rectangle.width > 0 && rectangle.height > 0) {
        const deltaTime = (frameStartedAt - this.lastFrameTime) / 1000;
        this.lastFrameTime = frameStartedAt;

        this.flushPendingRendererOptions();
        this.syncRendererSize(rectangle);
        const frame = renderer.renderFrame
          ? await renderer.renderFrame(deltaTime, this.onFrame, { ansi: true })
          : { grid: await renderer.renderToAnsiGrid(deltaTime, this.onFrame) };
        const grid = frame.grid ?? [];

        if (!this.isCurrentFrame(frameGeneration, renderer)) {
          return;
        }

        this.grid = grid;
        if (this.queueChangedGridCells(grid, rectangle, frame.gridRevision)) {
          this.updated = false;
          this.canvas.updateObjects.push(this);
        }
      }
    } catch (error) {
      if (!this.isCurrentFrame(frameGeneration, renderer)) {
        return;
      }
      this.failed = true;
      this.running = false;
      this.syncPending = false;
      const rectangle = this.rectangle.peek();
      this.grid = buildFallbackGrid(
        rectangle.width,
        rectangle.height,
        formatThreeAsciiFallbackDetail(error),
      );
      if (this.queueChangedGridCells(this.grid, rectangle)) {
        this.updated = false;
        this.canvas.updateObjects.push(this);
      }
    } finally {
      this.rendering = false;

      if (this.destroyPending) {
        renderer.destroy();
        this.destroyPending = false;
        this.syncPending = false;
      }

      if (this.syncPending && !this.destroyPending) {
        this.syncPending = false;
        this.running = true;
        this.frameTimer = setTimeout(() => void this.renderLoop(), 0);
      } else if (this.running) {
        this.frameTimer = setTimeout(
          () => void this.renderLoop(),
          nextFrameDelay(this.frameInterval, frameStartedAt, performance.now()),
        );
      }
    }
  }

  private invalidateFrame(): void {
    this.frameGeneration += 1;
    this.clearPreviousGridCells();
  }

  private isCurrentFrame(generation: number, renderer: ThreeAsciiGridRenderer): boolean {
    return this.running && this.frameGeneration === generation && this.renderer === renderer;
  }

  private flushPendingRendererOptions(): void {
    if (this.pendingEffectOptions) {
      this.renderer.setEffectOptions(this.pendingEffectOptions);
      this.pendingEffectOptions = undefined;
    }
    if (this.pendingTerminalEdgeBias !== undefined) {
      this.renderer.setTerminalEdgeBias(this.pendingTerminalEdgeBias);
      this.pendingTerminalEdgeBias = undefined;
    }
    if (this.pendingTerminalGlyphStyle !== undefined) {
      this.renderer.setTerminalGlyphStyle(this.pendingTerminalGlyphStyle);
      this.pendingTerminalGlyphStyle = undefined;
    }
  }

  private syncRendererSize(rectangle: Rectangle): boolean {
    const columns = Math.max(1, Math.floor(rectangle.width));
    const rows = Math.max(1, Math.floor(rectangle.height));
    if (columns === this.rendererColumns && rows === this.rendererRows) return false;
    this.rendererColumns = columns;
    this.rendererRows = rows;
    this.renderer.setSize(columns, rows);
    return true;
  }

  private queueChangedGridCells(grid: string[][], rectangle: Rectangle, gridRevision?: number): boolean {
    const key = this.gridDiffKey(rectangle);
    if (gridRevision !== undefined && this.lastQueuedGridRevision === gridRevision && this.lastQueuedGridKey === key) {
      return false;
    }
    const changed = queueChangedThreeAsciiGridCells(
      grid,
      rectangle,
      this.canvas.size.peek(),
      this.rerenderCells,
      this.previousGrid,
      this.view.peek()?.rectangle?.peek(),
      this.rerenderRanges,
    );
    if (gridRevision !== undefined) {
      this.lastQueuedGridRevision = gridRevision;
      this.lastQueuedGridKey = key;
    }
    return changed;
  }

  private clearPreviousGridCells(): void {
    clearThreeAsciiGridDiffState(this.previousGrid);
    this.lastQueuedGridRevision = undefined;
    this.lastQueuedGridKey = "";
  }

  private gridDiffKey(rectangle: Rectangle): string {
    const canvas = this.canvas.size.peek();
    const view = this.view.peek()?.rectangle?.peek();
    return `${rectangle.column},${rectangle.row},${rectangle.width},${rectangle.height}|${canvas.columns},${canvas.rows}|${
      view ? `${view.column},${view.row},${view.width},${view.height}` : "-"
    }`;
  }

  private showStatusGrid(detail: string, heading = "ASCII RENDERER OFFLINE"): void {
    const rectangle = this.rectangle.peek();
    if (rectangle.width <= 0 || rectangle.height <= 0) return;
    this.grid = buildFallbackGrid(rectangle.width, rectangle.height, detail, heading);
    this.clearPreviousGridCells();
    if (this.queueChangedGridCells(this.grid, rectangle)) {
      this.updated = false;
      this.canvas.updateObjects.push(this);
    }
  }
}

interface ApplyThreeAsciiRerenderRangesOptions {
  frameRow: (string | Uint8Array)[];
  outputRow: readonly string[] | undefined;
  ranges: DirtyRowSegment[];
  row: number;
  rectangleColumn: number;
  columnLimit: number;
  omitColumns?: ReadonlySet<number>;
  directRanges?: DirtyRowSegment[];
  fallbackCells?: Set<number>;
}

interface ApplyThreeAsciiRerenderCellsOptions {
  frameRow: (string | Uint8Array)[];
  outputRow: readonly string[] | undefined;
  columns: ReadonlySet<number>;
  rectangleColumn: number;
  columnLimit: number;
  omitColumns?: ReadonlySet<number>;
  queueCells: Set<number>;
}

interface ThreeAsciiDiffCanvasSize {
  columns: number;
  rows: number;
}

type ThreeAsciiDiffQueue = Array<Set<number> | undefined>;
type ThreeAsciiDiffRangeQueue = Array<DirtyRowSegment[] | undefined>;

interface ThreeAsciiGridDiffState {
  cells: string[];
  columns: number;
  rows: number;
}

interface QueueChangedCellsInternalOptions {
  grid: readonly (readonly string[] | undefined)[];
  rectangle: Rectangle;
  previous: ThreeAsciiGridDiffState;
  cacheValid: boolean;
  columns: number;
  rows: number;
}

interface QueueIntegerAlignedCellsOptions extends QueueChangedCellsInternalOptions {
  canvasSize: ThreeAsciiDiffCanvasSize;
  rerenderCells: ThreeAsciiDiffQueue;
  viewRectangle?: Rectangle;
  rerenderRanges?: ThreeAsciiDiffRangeQueue;
}

interface QueueFullyVisibleIntegerCellsOptions extends QueueChangedCellsInternalOptions {
  rerenderCells: ThreeAsciiDiffQueue;
  rerenderRanges?: ThreeAsciiDiffRangeQueue;
}

interface QueueFullyVisibleIntegerRangesOptions extends QueueChangedCellsInternalOptions {
  rerenderRanges: ThreeAsciiDiffRangeQueue;
}

interface QueueFractionalCellsOptions extends QueueChangedCellsInternalOptions {
  canvasSize: ThreeAsciiDiffCanvasSize;
  viewRectangle?: Rectangle;
  rerenderCells: ThreeAsciiDiffQueue;
}

function createThreeAsciiGridDiffState(): ThreeAsciiGridDiffState {
  return { cells: [], columns: 0, rows: 0 };
}

function clearThreeAsciiGridDiffState(state: ThreeAsciiGridDiffState): void {
  state.cells.length = 0;
  state.columns = 0;
  state.rows = 0;
}

function queueChangedThreeAsciiGridCells(
  grid: readonly (readonly string[] | undefined)[],
  rectangle: Rectangle,
  canvasSize: ThreeAsciiDiffCanvasSize,
  rerenderCells: ThreeAsciiDiffQueue,
  previous: ThreeAsciiGridDiffState,
  viewRectangle?: Rectangle,
  rerenderRanges?: ThreeAsciiDiffRangeQueue,
): boolean {
  const columns = Math.max(0, rectangle.width);
  const rows = Math.max(0, rectangle.height);
  const cellCount = columns * rows;
  const cacheValid = previous.columns === columns && previous.rows === rows && previous.cells.length === cellCount;

  if (!cacheValid) {
    previous.cells.length = cellCount;
    previous.columns = columns;
    previous.rows = rows;
  }

  if (columns <= 0 || rows <= 0) return false;

  if (Number.isInteger(rectangle.column) && Number.isInteger(rectangle.row)) {
    if (
      viewRectangle === undefined &&
      rectangle.column >= 0 &&
      rectangle.row >= 0 &&
      rectangle.column + columns <= canvasSize.columns &&
      rectangle.row + rows <= canvasSize.rows
    ) {
      return queueChangedFullyVisibleIntegerCells({
        grid,
        rectangle,
        rerenderCells,
        previous,
        cacheValid,
        columns,
        rows,
        rerenderRanges,
      });
    }
    return queueChangedIntegerAlignedCells({
      grid,
      rectangle,
      canvasSize,
      viewRectangle,
      rerenderCells,
      previous,
      cacheValid,
      columns,
      rows,
      rerenderRanges,
    });
  }

  return queueChangedFractionalCells({
    grid,
    rectangle,
    rerenderCells,
    previous,
    cacheValid,
    columns,
    rows,
    canvasSize,
    viewRectangle,
  });
}

function applyThreeAsciiRerenderRanges(options: ApplyThreeAsciiRerenderRangesOptions): void {
  const {
    frameRow,
    outputRow,
    ranges,
    row,
    rectangleColumn,
    columnLimit,
    omitColumns,
    directRanges,
    fallbackCells,
  } = options;
  const hasOmissions = !!omitColumns?.size;

  for (const range of ranges) {
    const start = Math.max(range.startColumn, rectangleColumn);
    const end = Math.min(range.endColumn, columnLimit);
    if (end <= start) continue;

    if (!hasOmissions) {
      copyThreeAsciiRange(frameRow, outputRow, rectangleColumn, start, end);
      directRanges?.push({ row, startColumn: start, endColumn: end });
      continue;
    }

    for (let column = start; column < end; column += 1) {
      if (omitColumns!.has(column)) continue;
      frameRow[column] = outputRow?.[column - rectangleColumn] ?? " ";
      fallbackCells?.add(column);
    }
  }
}

function applyThreeAsciiRerenderCells(options: ApplyThreeAsciiRerenderCellsOptions): void {
  const { frameRow, outputRow, columns, rectangleColumn, columnLimit, omitColumns, queueCells } = options;
  for (const column of columns) {
    if (column < rectangleColumn || column >= columnLimit || omitColumns?.has(column)) continue;
    frameRow[column] = outputRow?.[column - rectangleColumn] ?? " ";
    queueCells.add(column);
  }
}

function queueChangedFullyVisibleIntegerCells(options: QueueFullyVisibleIntegerCellsOptions): boolean {
  const { grid, rectangle, rerenderCells, rerenderRanges, previous, cacheValid, columns, rows } = options;
  if (rerenderRanges) {
    return queueChangedFullyVisibleIntegerRanges({
      grid,
      rectangle,
      previous,
      cacheValid,
      columns,
      rows,
      rerenderRanges,
    });
  }

  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    let runStart = -1;

    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const cell = outputRow[column] as string;
        if (cacheValid && previousCells[index] === cell) {
          if (runStart !== -1) {
            queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
            runStart = -1;
          }
          continue;
        }
        previousCells[index] = cell;
        if (runStart === -1) runStart = column;
        changed = true;
      }
      if (runStart !== -1) {
        queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
      }
      continue;
    }

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) {
        if (runStart !== -1) {
          queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (runStart === -1) runStart = column;
      changed = true;
    }
    if (runStart !== -1) {
      queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
    }
  }

  return changed;
}

function queueChangedFullyVisibleIntegerRanges(options: QueueFullyVisibleIntegerRangesOptions): boolean {
  const { grid, rectangle, rerenderRanges, previous, columns, rows } = options;
  if (!options.cacheValid) {
    return queueInitialFullyVisibleIntegerRanges(options);
  }
  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    let runStart = -1;

    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const cell = outputRow[column] as string;
        if (previousCells[index] === cell) {
          if (runStart !== -1) {
            queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
            runStart = -1;
          }
          continue;
        }
        previousCells[index] = cell;
        if (runStart === -1) runStart = column;
        changed = true;
      }
      if (runStart !== -1) {
        queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
      }
      continue;
    }

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (previousCells[index] === cell) {
        if (runStart !== -1) {
          queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (runStart === -1) runStart = column;
      changed = true;
    }
    if (runStart !== -1) {
      queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
    }
  }

  return changed;
}

function queueInitialFullyVisibleIntegerRanges(options: QueueFullyVisibleIntegerRangesOptions): boolean {
  const { grid, rectangle, rerenderRanges, previous, columns, rows } = options;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        previousCells[rowOffset + column] = outputRow[column] as string;
      }
    } else {
      for (let column = 0; column < columns; column += 1) {
        previousCells[rowOffset + column] = outputRow?.[column] ?? " ";
      }
    }
    queueFullyVisibleRangeRun(
      rerenderRanges,
      rectangleRow + row,
      rectangleColumn,
      rectangleColumn + columns,
    );
  }

  return rows > 0 && columns > 0;
}

function queueChangedIntegerAlignedCells(options: QueueIntegerAlignedCellsOptions): boolean {
  const {
    grid,
    rectangle,
    canvasSize,
    viewRectangle,
    rerenderCells,
    rerenderRanges,
    previous,
    cacheValid,
    columns,
    rows,
  } = options;
  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const canvasColumnStart = Math.max(0, rectangleColumn);
  const canvasColumnEnd = Math.min(canvasSize.columns, rectangleColumn + columns);
  const visibleColumnStart = viewRectangle ? Math.max(canvasColumnStart, viewRectangle.column) : canvasColumnStart;
  const visibleColumnEnd = viewRectangle
    ? Math.min(canvasColumnEnd, viewRectangle.column + viewRectangle.width)
    : canvasColumnEnd;
  const visibleGridColumnStart = Math.max(0, visibleColumnStart - rectangleColumn);
  const visibleGridColumnEnd = Math.min(columns, visibleColumnEnd - rectangleColumn);
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    const rowVisible = canvasRow >= 0 && canvasRow < canvasSize.rows &&
      (!viewRectangle || (canvasRow >= viewRectangle.row && canvasRow < viewRectangle.row + viewRectangle.height));
    let runStart = -1;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) {
        if (runStart !== -1 && rowVisible) {
          queueChangedRun(
            rerenderCells,
            rerenderRanges,
            canvasRow,
            rectangleColumn + runStart,
            rectangleColumn + column,
            canvasSize,
            viewRectangle,
          );
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (rowVisible && column >= visibleGridColumnStart && column < visibleGridColumnEnd) {
        if (runStart === -1) runStart = column;
      } else if (runStart !== -1) {
        queueChangedRun(
          rerenderCells,
          rerenderRanges,
          canvasRow,
          rectangleColumn + runStart,
          rectangleColumn + column,
          canvasSize,
          viewRectangle,
        );
        runStart = -1;
      }
      changed = true;
    }
    if (runStart !== -1 && rowVisible) {
      queueChangedRun(
        rerenderCells,
        rerenderRanges,
        canvasRow,
        rectangleColumn + runStart,
        rectangleColumn + columns,
        canvasSize,
        viewRectangle,
      );
    }
  }

  return changed;
}

function queueChangedFractionalCells(options: QueueFractionalCellsOptions): boolean {
  const { grid, rectangle, previous, cacheValid, columns, rows } = options;
  let changed = false;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangle.row + row;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) continue;
      previousCells[index] = cell;
      queueFractionalRerenderCell(options, canvasRow, rectangle.column + column);
      changed = true;
    }
  }

  return changed;
}

function queueFractionalRerenderCell(options: QueueFractionalCellsOptions, row: number, column: number): void {
  const canvasRow = Math.floor(row);
  queueRerenderCellInto(
    options.rerenderCells,
    canvasRow,
    column,
    options.canvasSize,
    options.viewRectangle,
  );
}

function queueChangedRun(
  rerenderCells: ThreeAsciiDiffQueue,
  rerenderRanges: ThreeAsciiDiffRangeQueue | undefined,
  row: number,
  startColumn: number,
  endColumn: number,
  canvasSize: ThreeAsciiDiffCanvasSize,
  viewRectangle?: Rectangle,
): void {
  if (rerenderRanges) {
    queueRerenderRangeOnlyInto(rerenderRanges, row, startColumn, endColumn, canvasSize, viewRectangle);
    return;
  }
  queueRerenderRangeInto(rerenderCells, row, startColumn, endColumn, canvasSize, viewRectangle);
}

function queueFullyVisibleCellRun(
  rerenderCells: ThreeAsciiDiffQueue,
  row: number,
  startColumn: number,
  endColumn: number,
): void {
  const queueRow = rerenderCells[row] ??= new Set<number>();
  for (let column = startColumn; column < endColumn; column += 1) {
    queueRow.add(column);
  }
}

function queueFullyVisibleRangeRun(
  rerenderRanges: ThreeAsciiDiffRangeQueue,
  row: number,
  startColumn: number,
  endColumn: number,
): void {
  (rerenderRanges[row] ??= []).push({ row, startColumn, endColumn });
}

function copyThreeAsciiRange(
  frameRow: (string | Uint8Array)[],
  outputRow: readonly string[] | undefined,
  rectangleColumn: number,
  start: number,
  end: number,
): void {
  if (frameRow.length < end) frameRow.length = end;
  if (!outputRow) {
    frameRow.fill(" ", start, end);
    return;
  }

  let column = start;
  let sourceColumn = start - rectangleColumn;
  while (column < end) {
    const cell = outputRow[sourceColumn] ?? " ";
    let nextColumn = column + 1;
    let nextSourceColumn = sourceColumn + 1;
    while (nextColumn < end && (outputRow[nextSourceColumn] ?? " ") === cell) {
      nextColumn += 1;
      nextSourceColumn += 1;
    }

    if (nextColumn - column === 1) {
      frameRow[column] = cell;
    } else {
      frameRow.fill(cell, column, nextColumn);
    }
    column = nextColumn;
    sourceColumn = nextSourceColumn;
  }
}

/** Formats three Ascii Fallback Detail for display or diagnostics. */
export function formatThreeAsciiFallbackDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "GPU BACKEND UNAVAILABLE";

  const rawGpuPatterns = [
    /BUFFER WITH .* LABEL IS INVALID/i,
    /GPU.*VALIDATION/i,
    /VALIDATION ERROR/i,
    /DEVICE.*LOST/i,
    /ADAPTER.*UNAVAILABLE/i,
  ];
  if (rawGpuPatterns.some((pattern) => pattern.test(normalized))) {
    return "GPU BACKEND UNAVAILABLE";
  }

  return normalized;
}

/** Public helper for build Fallback Grid. */
export function buildFallbackGrid(
  width: number,
  height: number,
  detail: string,
  heading = "ASCII RENDERER OFFLINE",
): string[][] {
  const columns = Math.max(1, Math.floor(width));
  const rows = Math.max(1, Math.floor(height));
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    const gridRow = new Array<string>(columns);
    for (let column = 0; column < columns; column += 1) {
      gridRow[column] = fallbackGridCell(row, column);
    }
    grid[row] = gridRow;
  }
  const message = cropMessage(detail, columns);
  const lineCount = message.length > 0 && message !== heading ? 2 : 1;
  const lines = new Array<string>(lineCount);
  lines[0] = heading;
  if (lineCount > 1) lines[1] = message;
  const startRow = Math.max(0, Math.floor((rows - lines.length) / 2));

  for (let index = 0; index < lines.length && startRow + index < rows; index += 1) {
    const line = lines[index] ?? "";
    const startColumn = Math.max(0, Math.floor((columns - line.length) / 2));
    for (let column = 0; column < line.length && startColumn + column < columns; column += 1) {
      grid[startRow + index]![startColumn + column] = fallbackMessageCell(line[column] ?? " ");
    }
  }

  return grid;
}

function fallbackGridCell(row: number, column: number): string {
  const band = (Math.floor(row / 2) + Math.floor(column / 8)) % 2;
  return band === 0 ? "\x1b[48;2;18;10;28m \x1b[0m" : "\x1b[48;2;28;14;44m \x1b[0m";
}

function fallbackMessageCell(glyph: string): string {
  return `\x1b[38;2;244;232;255m\x1b[48;2;74;36;112m${glyph}\x1b[0m`;
}

function cropMessage(message: string, width: number): string {
  const cleaned = message.replace(/\s+/g, " ").trim().toUpperCase();
  if (width <= 0) {
    return "";
  }
  if (cleaned.length <= width) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, width - 1))}…`;
}
