import type { DiagnosticInput, DiagnosticsCollector } from "../runtime/diagnostics.ts";
import type { GraphicsHandle, GraphicsSurface, GraphicsSurfaceInspection } from "../runtime/graphics_surface.ts";
import type { TerminalGlyphStyle } from "../three_ascii/glyphs.ts";
import type { ThreeAsciiImageFrame, ThreeAsciiRendererPerformance } from "../three_ascii/renderer.ts";

export interface ThreePanelValueSignal<T> {
  peek(): T;
}

export interface ThreePanelGraphicsRect {
  column: number;
  row: number;
  width: number;
  height: number;
}

export type ThreePanelResolvableValue<T> = T | ThreePanelValueSignal<T>;
export type ThreePanelResolvableLiveValue = boolean | ThreePanelValueSignal<boolean> | (() => boolean);

export type ThreePanelLifecycleState =
  | "idle"
  | "initializing"
  | "rendering"
  | "resizing"
  | "reconfiguring"
  | "stopping"
  | "failed"
  | "disposed";

export interface ThreePanelLifecycleStateInput {
  disposed: boolean;
  failed: boolean;
  destroyPending: boolean;
  rebuildPending: boolean;
  syncPending: boolean;
  rendering: boolean;
  hasRenderer: boolean;
  visible: boolean;
  gridRows: number;
}

export interface ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  disposed: boolean;
  currentGeneration: number;
  frameGeneration: number;
  currentRenderer: TRenderer | undefined;
  frameRenderer: TRenderer;
  currentBundle: TBundle | undefined;
  frameBundle: TBundle;
}

export interface ThreePanelCurrentFrameInput<TRenderer, TBundle>
  extends ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  running: boolean;
}

export interface ThreePanelFrameUpdate {
  rendererBacked: boolean;
  rows: number;
  columns: number;
}

export interface ThreePanelGridPublicationInput {
  grid: readonly (readonly string[] | undefined)[];
  currentGrid?: readonly (readonly string[] | undefined)[];
  forceUpdate?: boolean;
  revision?: number;
}

export interface ThreePanelGridPublishRequest {
  grid: string[][];
  currentGrid?: readonly (readonly string[] | undefined)[];
  rendererBacked?: boolean;
  revision?: number;
}

export interface ThreePanelGridPublishDecision {
  publish: boolean;
  grid: string[][];
  rendererBacked: boolean;
}

export interface ThreePanelAsciiEffectOptions {
  edgeThreshold?: number;
  normalThreshold?: number;
  depthThreshold?: number;
  exposure?: number;
  attenuation?: number;
  blendWithBase?: number;
  depthFalloff?: number;
  depthOffset?: number;
  edges?: boolean;
  fill?: boolean;
  invertLuminance?: boolean;
}

export interface ThreePanelRendererStateSnapshot {
  columns: number;
  rows: number;
  effectOptions?: ThreePanelAsciiEffectOptions;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
}

export interface ThreePanelRendererStateUpdate {
  next: ThreePanelRendererStateSnapshot;
  resize: boolean;
  effect: boolean;
  terminalEdgeBias: boolean;
  terminalGlyphStyle: boolean;
  changed: boolean;
}

export interface ThreePanelAdaptiveDiagnosticOptions {
  direction: "down" | "up" | "steady";
  maxCells: number;
  requestedMaxCells: number;
  frameMs: number;
  targetMs: number;
}

export interface ThreePanelGraphicsFallbackReasonOptions {
  inspection?: GraphicsSurfaceInspection;
  rect: Pick<{ width: number; height: number }, "width" | "height">;
  rendererSupportsImage: boolean;
}

export interface ThreePanelGraphicsFallbackDiagnosticOptions extends ThreePanelGraphicsFallbackReasonOptions {
  kittyDisableAscii: boolean;
}

export interface ThreePanelRenderQueueInspection {
  running: number;
  pending: number;
  scheduled: number;
  completed: number;
  failed: number;
}

/** Serializes expensive Three panel frame work so WebGPU readbacks do not compete across panes. */
export class ThreePanelRenderQueue {
  #tail: Promise<void> = Promise.resolve();
  #running = 0;
  #pending = 0;
  #scheduled = 0;
  #completed = 0;
  #failed = 0;

  run<T>(task: () => T | Promise<T>): Promise<T> {
    this.#pending += 1;
    this.#scheduled += 1;

    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    return previous
      .catch(() => undefined)
      .then(async () => {
        this.#pending -= 1;
        this.#running += 1;
        try {
          const value = await task();
          this.#completed += 1;
          return value;
        } catch (error) {
          this.#failed += 1;
          throw error;
        } finally {
          this.#running -= 1;
          release();
        }
      });
  }

  inspect(): ThreePanelRenderQueueInspection {
    return {
      running: this.#running,
      pending: this.#pending,
      scheduled: this.#scheduled,
      completed: this.#completed,
      failed: this.#failed,
    };
  }
}

export const defaultThreePanelRenderQueue = new ThreePanelRenderQueue();

/** Owns the active raster graphics image handle for a workbench-hosted Three panel. */
export class ThreePanelGraphicsImageController {
  private handle?: GraphicsHandle;

  constructor(
    private readonly options: {
      diagnostics?: DiagnosticsCollector;
      currentGeneration: () => number;
      disposed: () => boolean;
    },
  ) {}

  get hasHandle(): boolean {
    return this.handle !== undefined;
  }

  /** Replaces the current image and deletes stale handles if the owning panel generation changes mid-publish. */
  async put(
    surface: GraphicsSurface,
    image: ThreeAsciiImageFrame,
    rect: ThreePanelGraphicsRect,
    frameGeneration: number,
  ): Promise<void> {
    if (this.options.disposed() || rect.width <= 0 || rect.height <= 0) return;
    if (this.handle) {
      await this.delete(surface, this.handle, "replace");
      this.handle = undefined;
    }
    const handle = await surface.putImage({
      data: image.data,
      encoding: image.encoding,
      format: image.format,
      pixelWidth: image.pixelWidth,
      pixelHeight: image.pixelHeight,
    }, {
      column: rect.column,
      row: rect.row,
      width: rect.width,
      height: rect.height,
      zIndex: 1,
    });
    if (this.options.disposed() || this.options.currentGeneration() !== frameGeneration) {
      await this.delete(surface, handle, "stale-frame");
      return;
    }
    this.handle = handle;
  }

  /** Deletes the current image handle if a graphics surface is available. */
  async clear(surface: GraphicsSurface | undefined): Promise<void> {
    const handle = this.handle;
    if (!handle) return;
    this.handle = undefined;
    if (!surface) return;
    await this.delete(surface, handle, "clear");
  }

  private async delete(
    surface: GraphicsSurface,
    handle: GraphicsHandle,
    reason: "replace" | "stale-frame" | "clear",
  ): Promise<void> {
    try {
      await surface.deleteImage(handle, "image");
    } catch (error) {
      this.options.diagnostics?.report({
        source: "three-panel",
        code: "graphics-delete-failed",
        severity: "debug",
        message: "Three panel graphics image cleanup failed",
        detail: error instanceof Error ? error.message : String(error),
        context: {
          reason,
          handleId: handle.id,
          surface: surface.kind,
        },
      });
    }
  }
}

/** Tracks published Three panel grid identity so unchanged renderer frames do not trigger terminal redraws. */
export class ThreePanelGridPublicationCache {
  #fingerprint = "";
  #revision?: number;

  shouldPublish(input: ThreePanelGridPublicationInput): boolean {
    const { grid, currentGrid, forceUpdate = false, revision } = input;
    if (revision !== undefined) {
      if (this.#revision === revision) return false;
      const fingerprint = fingerprintThreePanelGrid(grid);
      this.#revision = revision;
      if (this.#fingerprint === fingerprint) return false;
      this.#fingerprint = fingerprint;
      return true;
    }

    this.#revision = undefined;
    const fingerprint = fingerprintThreePanelGrid(grid);
    if (!forceUpdate && currentGrid === grid) return false;
    if (this.#fingerprint === fingerprint) return false;
    this.#fingerprint = fingerprint;
    return true;
  }

  reset(): void {
    this.#fingerprint = "";
    this.#revision = undefined;
  }
}

/** Owns reusable Three panel grid buffers and publication filtering. */
export class ThreePanelGridPublisher {
  readonly publication = new ThreePanelGridPublicationCache();
  #blankGridCache: string[][] = [];
  #blankGridColumns = -1;
  #blankGridRows = -1;

  blankGridFor(columns: number, rows: number): string[][] {
    if (this.#blankGridColumns === columns && this.#blankGridRows === rows) return this.#blankGridCache;
    this.#blankGridColumns = columns;
    this.#blankGridRows = rows;
    this.#blankGridCache = threePanelBlankGrid(columns, rows);
    return this.#blankGridCache;
  }

  shouldPublish(input: ThreePanelGridPublishRequest): ThreePanelGridPublishDecision {
    const rendererBacked = input.rendererBacked ?? false;
    return {
      publish: this.publication.shouldPublish({
        grid: input.grid,
        currentGrid: input.currentGrid,
        forceUpdate: rendererBacked,
        revision: input.revision,
      }),
      grid: input.grid,
      rendererBacked,
    };
  }

  reset(): void {
    this.publication.reset();
    this.#blankGridCache = [];
    this.#blankGridColumns = -1;
    this.#blankGridRows = -1;
  }
}

export function resolveThreePanelValue<T>(value: ThreePanelResolvableValue<T>): T {
  return isThreePanelValueSignal(value) ? value.peek() : value;
}

export function resolveOptionalThreePanelValue<T>(
  value: ThreePanelResolvableValue<T> | undefined,
): T | undefined {
  return value === undefined ? undefined : resolveThreePanelValue(value);
}

export function resolveThreePanelLiveValue(value: ThreePanelResolvableLiveValue | undefined): boolean {
  if (value === undefined) return true;
  if (isThreePanelValueSignal(value)) return value.peek();
  if (typeof value === "function") return value();
  return value;
}

export function resolveThreePanelLifecycleState(input: ThreePanelLifecycleStateInput): ThreePanelLifecycleState {
  if (input.disposed) return "disposed";
  if (input.failed) return "failed";
  if (input.rebuildPending) return "reconfiguring";
  if (input.syncPending) return "resizing";
  if (input.destroyPending) return "stopping";
  if (input.rendering) return "rendering";
  if (input.hasRenderer && input.visible && input.gridRows === 0) return "initializing";
  return "idle";
}

export function ownsThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelFrameOwnershipInput<TRenderer, TBundle>,
): boolean {
  return !input.disposed && input.currentGeneration === input.frameGeneration &&
    input.currentRenderer === input.frameRenderer && input.currentBundle === input.frameBundle;
}

export function isCurrentThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelCurrentFrameInput<TRenderer, TBundle>,
): boolean {
  return input.running && ownsThreePanelFrame(input);
}

/** Builds the lightweight event payload emitted when a Three panel renders or publishes a grid. */
export function threePanelFrameUpdate(
  grid: readonly (readonly string[] | undefined)[] | undefined,
  rendererBacked: boolean,
): ThreePanelFrameUpdate {
  return {
    rendererBacked,
    rows: grid?.length ?? 0,
    columns: grid?.[0]?.length ?? 0,
  };
}

export function threePanelBlankGrid(width: number, height: number): string[][] {
  const columns = Math.max(0, width);
  const rows = Math.max(0, height);
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    const gridRow = new Array<string>(columns);
    for (let column = 0; column < columns; column += 1) {
      gridRow[column] = " ";
    }
    grid[row] = gridRow;
  }
  return grid;
}

export function fingerprintThreePanelGrid(grid: readonly (readonly string[] | undefined)[]): string {
  let hash = mixThreePanelGridHash(2166136261, grid.length);
  for (const row of grid) {
    const columns = row?.length ?? 0;
    hash = mixThreePanelGridHash(hash, columns);
    if (!row) continue;
    for (const cell of row) {
      hash = mixThreePanelGridHash(hash, cell.length);
      for (let index = 0; index < cell.length; index += 1) {
        hash = mixThreePanelGridHash(hash, cell.charCodeAt(index));
      }
    }
  }
  return `${grid.length}:${hash.toString(36)}`;
}

export function hasThreePanelGridCells(grid: readonly (readonly string[] | undefined)[]): boolean {
  return grid.length > 0 && (grid[0]?.length ?? 0) > 0;
}

export function emptyThreePanelRendererState(): ThreePanelRendererStateSnapshot {
  return {
    columns: 0,
    rows: 0,
  };
}

/** Compare the Three panel ASCII effect fields that require renderer effect updates. */
export function threePanelAsciiEffectOptionsEqual(
  left: ThreePanelAsciiEffectOptions | undefined,
  right: ThreePanelAsciiEffectOptions,
): boolean {
  if (!left) return false;
  return left.edgeThreshold === right.edgeThreshold &&
    left.normalThreshold === right.normalThreshold &&
    left.depthThreshold === right.depthThreshold &&
    left.exposure === right.exposure &&
    left.attenuation === right.attenuation &&
    left.blendWithBase === right.blendWithBase &&
    left.depthFalloff === right.depthFalloff &&
    left.depthOffset === right.depthOffset &&
    left.edges === right.edges &&
    left.fill === right.fill &&
    left.invertLuminance === right.invertLuminance;
}

/** Compare applied and requested renderer state without considering scene signal changes. */
export function threePanelRendererStateMatches(
  current: ThreePanelRendererStateSnapshot,
  next: ThreePanelRendererStateSnapshot,
): boolean {
  return current.columns === next.columns &&
    current.rows === next.rows &&
    next.effectOptions !== undefined &&
    threePanelAsciiEffectOptionsEqual(current.effectOptions, next.effectOptions) &&
    current.terminalEdgeBias === next.terminalEdgeBias &&
    current.terminalGlyphStyle === next.terminalGlyphStyle;
}

export function resolveThreePanelRendererStateUpdate(
  current: ThreePanelRendererStateSnapshot,
  next: ThreePanelRendererStateSnapshot,
): ThreePanelRendererStateUpdate {
  const resize = current.columns !== next.columns || current.rows !== next.rows;
  const effect = next.effectOptions !== undefined &&
    !threePanelAsciiEffectOptionsEqual(current.effectOptions, next.effectOptions);
  const terminalEdgeBias = current.terminalEdgeBias !== next.terminalEdgeBias;
  const terminalGlyphStyle = current.terminalGlyphStyle !== next.terminalGlyphStyle;
  return {
    next,
    resize,
    effect,
    terminalEdgeBias,
    terminalGlyphStyle,
    changed: resize || effect || terminalEdgeBias || terminalGlyphStyle,
  };
}

export function threePanelSlowFrameDiagnostic(performance: ThreeAsciiRendererPerformance): DiagnosticInput {
  return {
    source: "three-panel",
    code: "three-ascii-slow-frame",
    severity: "debug",
    message: `Three ASCII frame ${performance.totalMs.toFixed(1)}ms at ${performance.columns}x${performance.rows}`,
    detail: `init ${performance.initMs.toFixed(1)}ms, scene ${performance.sceneMs.toFixed(1)}ms${
      performance.sceneUpdateMs === undefined ? "" : `, update ${performance.sceneUpdateMs.toFixed(1)}ms`
    }${performance.sceneRenderMs === undefined ? "" : `, render ${performance.sceneRenderMs.toFixed(1)}ms`}, ansi ${
      performance.ansiMs.toFixed(1)
    }ms, readback ${performance.readbackMs.toFixed(1)}ms, assembly ${performance.assemblyMs.toFixed(1)}ms${
      threePanelReadbackQueueDetail(performance)
    }`,
    context: threePanelPerformanceContext(performance),
  };
}

export function threePanelAdaptiveRenderCellsDiagnostic(
  options: ThreePanelAdaptiveDiagnosticOptions,
): DiagnosticInput {
  return {
    source: "three-panel",
    code: "three-ascii-adaptive-render-cells",
    severity: "debug",
    message: `Three ASCII render budget ${
      options.direction === "down" ? "reduced" : "raised"
    } to ${options.maxCells} cells.`,
    detail: `frame ${options.frameMs.toFixed(1)}ms, target ${options.targetMs.toFixed(1)}ms`,
    context: {
      direction: options.direction,
      maxCells: options.maxCells,
      requestedMaxCells: options.requestedMaxCells,
      frameMs: roundTenth(options.frameMs),
      targetMs: roundTenth(options.targetMs),
    },
  };
}

export function threePanelGraphicsFallbackReason(options: ThreePanelGraphicsFallbackReasonOptions): string {
  const inspection = options.inspection;
  if (!inspection) return "missing-surface";
  if (!inspection.available) return inspection.reason ?? "surface-unavailable";
  if (options.rect.width <= 0 || options.rect.height <= 0) return "empty-graphics-rectangle";
  if (!options.rendererSupportsImage) return "renderer-image-frame-unsupported";
  return "inactive";
}

export function threePanelGraphicsFallbackDiagnostic(
  options: ThreePanelGraphicsFallbackDiagnosticOptions,
): DiagnosticInput {
  const reason = threePanelGraphicsFallbackReason(options);
  const inspection = options.inspection;
  return {
    source: "three-panel",
    code: "kitty-graphics-fallback",
    severity: "warning",
    message: "Kitty graphics requested but unavailable; rendering ASCII fallback.",
    detail: inspection?.reason ?? reason,
    context: {
      reason,
      surface: inspection?.kind ?? "none",
      available: inspection?.available ?? false,
      asciiFallback: true,
      kittyDisableAscii: options.kittyDisableAscii,
    },
  };
}

function isThreePanelValueSignal<T>(value: unknown): value is ThreePanelValueSignal<T> {
  return typeof value === "object" && value !== null && typeof (value as { peek?: unknown }).peek === "function";
}

function mixThreePanelGridHash(hash: number, value: number): number {
  return Math.imul((hash ^ value) >>> 0, 16777619) >>> 0;
}

function threePanelPerformanceContext(performance: ThreeAsciiRendererPerformance): Record<string, unknown> {
  return {
    columns: performance.columns,
    rows: performance.rows,
    cells: performance.cells,
    glyphStyle: performance.terminalGlyphStyle,
    totalMs: roundTenth(performance.totalMs),
    initMs: roundTenth(performance.initMs),
    sceneMs: roundTenth(performance.sceneMs),
    sceneUpdateMs: optionalRoundTenth(performance.sceneUpdateMs),
    sceneRenderMs: optionalRoundTenth(performance.sceneRenderMs),
    ansiMs: roundTenth(performance.ansiMs),
    readbackMs: roundTenth(performance.readbackMs),
    assemblyMs: roundTenth(performance.assemblyMs),
    deferredReadbackSlots: performance.deferredReadbackSlots,
    deferredReadbackPending: performance.deferredReadbackPending,
    deferredReadbackUnresolved: performance.deferredReadbackUnresolved,
    deferredReadbackSaturated: performance.deferredReadbackSaturated,
  };
}

function threePanelReadbackQueueDetail(performance: ThreeAsciiRendererPerformance): string {
  return performance.deferredReadbackSlots
    ? `, queue ${performance.deferredReadbackUnresolved ?? 0}/${performance.deferredReadbackSlots}`
    : "";
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function optionalRoundTenth(value: number | undefined): number | undefined {
  return value === undefined ? undefined : roundTenth(value);
}
