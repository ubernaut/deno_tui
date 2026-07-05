import { emptyStyle } from "../theme.ts";
import { DrawObject, type DrawObjectOptions } from "./draw_object.ts";
import { Signal, type SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import type { Rectangle } from "../types.ts";
import type { DirtyRowSegment } from "./dirty_region.ts";
import type { Camera, Scene } from "npm:three@0.183.2";
import type { AcerolaAsciiNodeOptions } from "../three_ascii/AcerolaAsciiNode.ts";
import type { TerminalGlyphStyle } from "../three_ascii/glyphs.ts";
import {
  clearThreeAsciiGridDiffState,
  createThreeAsciiGridDiffState,
  queueChangedThreeAsciiGridCells,
} from "./three_ascii_diff.ts";
import { applyThreeAsciiRerenderCells, applyThreeAsciiRerenderRanges } from "./three_ascii_ranges.ts";
import {
  type ThreeAsciiImageFrame,
  ThreeAsciiRenderer,
  type ThreeAsciiRendererOptions,
  type ThreeAsciiRenderFrame,
  type ThreeAsciiRenderFrameOptions,
} from "../three_ascii/renderer.ts";
import { nextFrameDelay } from "../runtime/frame_timing.ts";

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

  constructor(options: ThreeAsciiObjectOptions) {
    super("three_ascii", { ...options, style: emptyStyle });

    this.rectangle = signalify(options.rectangle, { deepObserve: true });
    const rendererFactory = options.rendererFactory ?? ((rendererOptions) => new ThreeAsciiRenderer(rendererOptions));
    this.renderer = rendererFactory({
      scene: options.scene,
      camera: options.camera,
      columns: options.rectangle instanceof Signal ? options.rectangle.peek().width : options.rectangle.width,
      rows: options.rectangle instanceof Signal ? options.rectangle.peek().height : options.rectangle.height,
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
      this.moved = true;
      this.updated = false;
      this.canvas.updateObjects.push(this);
      return;
    }
    this.renderer.setSize(rectangle.width, rectangle.height);
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
        renderer.setSize(rectangle.width, rectangle.height);
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
  const columns = Math.max(1, width);
  const rows = Math.max(1, height);
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    const gridRow = new Array<string>(columns);
    for (let column = 0; column < columns; column += 1) {
      gridRow[column] = " ";
    }
    grid[row] = gridRow;
  }
  const message = cropMessage(detail, columns);
  const lineCount = message.length > 0 && message !== heading ? 2 : 1;
  const lines = new Array<string>(lineCount);
  lines[0] = heading;
  if (lineCount > 1) lines[1] = message;
  const startRow = Math.max(0, Math.floor((rows - lines.length) / 2));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const startColumn = Math.max(0, Math.floor((columns - line.length) / 2));
    for (let column = 0; column < line.length && startColumn + column < columns; column += 1) {
      grid[startRow + index]![startColumn + column] = line[column] ?? " ";
    }
  }

  return grid;
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
