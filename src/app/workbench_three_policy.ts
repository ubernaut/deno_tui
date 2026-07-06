import {
  workbenchThreeFrameIntervalForCells,
  type WorkbenchThreeTerminalPressureOptions,
} from "./workbench_three_terminal_pressure.ts";
import type { ThreeAsciiConfigOptions } from "../three_ascii/options.ts";
import type { ThreeAsciiReadbackStrategy } from "../three_ascii/renderer_options.ts";

export const WORKBENCH_THREE_LIVE_MAX_CELLS = 960;
export const WORKBENCH_THREE_FULLSCREEN_MIN_CELLS = 3_840;
export const WORKBENCH_THREE_FULLSCREEN_MAX_CELLS = 30_720;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_FLOOR_CELLS = WORKBENCH_THREE_FULLSCREEN_MIN_CELLS;
export const WORKBENCH_THREE_RESCUE_CELLS = 30;
export const WORKBENCH_THREE_EMERGENCY_CELLS = 60;
export const WORKBENCH_THREE_INITIAL_CELLS = WORKBENCH_THREE_LIVE_MAX_CELLS;

export const WORKBENCH_THREE_PRESSURE_LEVELS = [
  480,
  WORKBENCH_THREE_LIVE_MAX_CELLS,
] as const;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS = [
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  7_680,
  15_400,
  WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
] as const;

export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES = 480_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES = 35_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_GRID = 24_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_GRID = 2_500;
export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_SECOND = 600_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_SECOND = 90_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_GRID = Number.POSITIVE_INFINITY;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_GRID = 18_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND = Number.POSITIVE_INFINITY;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND = 170_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS = 50;
export const WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD = 3;
export const WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD = 30;
export const WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO = 0.6;
export const WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES = 18;
export const WORKBENCH_THREE_DRAW_INTERVAL_MS = 1000 / 30;
export const WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS = 1000 / 10;
export const WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS = 1000 / 12;
export const WORKBENCH_THREE_READBACK_STRATEGY = "deferred" as const;

/** Minimal Three panel option shape that can receive workbench runtime defaults. */
export interface WorkbenchThreePanelDefaultableOptions {
  idleMaxRenderCells?: unknown;
  readbackStrategy?: ThreeAsciiReadbackStrategy;
}

/** Default values applied to workbench-hosted Three panels. */
export interface WorkbenchThreePanelDefaults {
  idleMaxRenderCells: number;
  readbackStrategy: ThreeAsciiReadbackStrategy;
}

export interface WorkbenchThreeWindowEntry<Id extends string = string> {
  id: Id;
}

export type WorkbenchThreeWindowStateSource<Id extends string = string> = Id | WorkbenchThreeWindowEntry<Id>;

export interface WorkbenchThreeWindowStateInput<Id extends string = string> {
  activeId: Id;
  fullscreenId?: Id | null;
  windows: readonly WorkbenchThreeWindowStateSource<string>[];
  isThreeWindow: (id: Id) => boolean;
  blocked?: boolean;
}

export interface WorkbenchThreeWindowState<Id extends string = string> {
  activeId: Id;
  fullscreenId: Id | null;
  fullscreenThree: boolean;
  live: boolean;
  blocked: boolean;
  threeWindowCount: number;
  interactiveIds: ReadonlySet<Id>;
}

export interface WorkbenchThreeSceneSignal {
  x: number;
  y: number;
  depth: number;
  twist: number;
  lift: number;
  pulse: number;
  active: boolean;
  pressed: boolean;
}

export interface WorkbenchThreeScene<TMode extends string = string> {
  mode: TMode;
  signal: WorkbenchThreeSceneSignal;
}

export interface WorkbenchStudioSceneInput {
  blocked?: boolean;
  minimized?: boolean;
  available?: boolean;
  density: number;
  progress: number;
  progressRatio: number;
  compactRows?: boolean;
  livePreview?: boolean;
  active?: boolean;
  pressed?: boolean;
}

export interface WorkbenchVisualizationThreeSceneInput {
  blocked?: boolean;
  available?: boolean;
  width: number;
  height: number;
  scene?: WorkbenchThreeScene | null;
  minWidth?: number;
  minHeight?: number;
}

export interface WorkbenchThreeSceneSignalTarget<TMode extends string = string> {
  peek(): WorkbenchThreeScene<TMode> | null;
  value: WorkbenchThreeScene<TMode> | null;
}

/** Inputs for resolving runtime-only fullscreen Three ASCII options. */
export interface WorkbenchThreeFullscreenAsciiOptionsInput<TId extends string> {
  id: TId;
  fullscreenId?: TId | null;
  ascii: ThreeAsciiConfigOptions;
  fullscreenMinCells: number;
}

/** Inputs for resolving one workbench Three runtime render budget snapshot. */
export interface WorkbenchThreeRuntimeBudgetSnapshotInput<TId extends string> {
  id: TId;
  fullscreenId?: TId | null;
  ascii: ThreeAsciiConfigOptions;
  liveMaxCells: number;
  liveViewport?: { width: number; height: number };
  fullscreenMaxCells: number;
  viewport: { width: number; height: number };
  fullscreenViewportPadding?: { columns?: number; rows?: number };
  isThreeWindow?: (id: TId) => boolean;
}

/** Runtime render budget values derived from the current viewport and fullscreen state. */
export interface WorkbenchThreeRuntimeBudgetSnapshot {
  fullscreenViewportCells: number;
  fullscreenTargetCells: number;
  effectiveMaxCells: number;
  runtimeAscii: ThreeAsciiConfigOptions;
}

export interface WorkbenchThreeTiledAsciiOptionsInput {
  ascii: ThreeAsciiConfigOptions;
  liveViewport: { width: number; height: number };
  liveMaxCells: number;
}

export const DEFAULT_WORKBENCH_THREE_PANEL_DEFAULTS: WorkbenchThreePanelDefaults = {
  idleMaxRenderCells: WORKBENCH_THREE_RESCUE_CELLS,
  readbackStrategy: WORKBENCH_THREE_READBACK_STRATEGY,
};

export type WorkbenchThreePanelDefaultedOptions<TOptions extends WorkbenchThreePanelDefaultableOptions> =
  & Omit<TOptions, "idleMaxRenderCells" | "readbackStrategy">
  & {
    idleMaxRenderCells: Exclude<TOptions["idleMaxRenderCells"], undefined> | number;
    readbackStrategy: ThreeAsciiReadbackStrategy;
  };

/** Applies shared workbench Three panel defaults while preserving explicit per-panel overrides. */
export function applyWorkbenchThreePanelFrameDefaults<TOptions extends WorkbenchThreePanelDefaultableOptions>(
  options: TOptions,
  defaults: WorkbenchThreePanelDefaults = DEFAULT_WORKBENCH_THREE_PANEL_DEFAULTS,
): WorkbenchThreePanelDefaultedOptions<TOptions> {
  return {
    ...options,
    idleMaxRenderCells: options.idleMaxRenderCells ?? defaults.idleMaxRenderCells,
    readbackStrategy: options.readbackStrategy ?? defaults.readbackStrategy,
  } as WorkbenchThreePanelDefaultedOptions<TOptions>;
}

export function workbenchStudioScene(input: WorkbenchStudioSceneInput): WorkbenchThreeScene<"studio"> | null {
  if (input.blocked || input.minimized || input.available === false) return null;
  const density = input.density / 10;
  return {
    mode: "studio",
    signal: {
      x: density,
      y: input.progress / 100,
      depth: density,
      twist: input.compactRows ? 0.8 : 0.25,
      lift: input.progressRatio,
      pulse: input.livePreview ? 0.7 : 0.15,
      active: input.active ?? false,
      pressed: input.pressed ?? false,
    },
  };
}

export function workbenchVisualizationThreeScene<TMode extends string>(
  input: Omit<WorkbenchVisualizationThreeSceneInput, "scene"> & { scene?: WorkbenchThreeScene<TMode> | null },
): WorkbenchThreeScene<TMode> | null {
  if (
    input.blocked ||
    input.available === false ||
    !input.scene ||
    input.width < (input.minWidth ?? 8) ||
    input.height < (input.minHeight ?? 9)
  ) return null;
  return input.scene;
}

export function setWorkbenchThreeSceneSignal(
  target: WorkbenchThreeSceneSignalTarget,
  next: WorkbenchThreeScene | null,
): boolean {
  if (sameWorkbenchThreeScene(target.peek(), next)) return false;
  target.value = next;
  return true;
}

export function sameWorkbenchThreeScene<TMode extends string>(
  left: WorkbenchThreeScene<TMode> | null,
  right: WorkbenchThreeScene<TMode> | null,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.mode !== right.mode) return false;
  return sameThreeSceneSignal(left.signal, right.signal);
}

export function sameThreeSceneSignal(left: WorkbenchThreeSceneSignal, right: WorkbenchThreeSceneSignal): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.depth === right.depth &&
    left.twist === right.twist &&
    left.lift === right.lift &&
    left.pulse === right.pulse &&
    left.active === right.active &&
    left.pressed === right.pressed;
}

/** Resolves the shared Three-window runtime state once per workbench frame. */
export function resolveWorkbenchThreeWindowState<Id extends string = string>(
  input: WorkbenchThreeWindowStateInput<Id>,
): WorkbenchThreeWindowState<Id> {
  return resolveWorkbenchThreeWindowStateInto(createWorkbenchThreeWindowState(input.activeId), input);
}

/** Creates a reusable Three-window runtime state object for per-frame updates. */
export function createWorkbenchThreeWindowState<Id extends string = string>(
  activeId: Id,
): WorkbenchThreeWindowState<Id> {
  return {
    activeId,
    fullscreenId: null,
    fullscreenThree: false,
    live: false,
    blocked: false,
    threeWindowCount: 0,
    interactiveIds: new Set<Id>(),
  };
}

/** Resolves Three-window runtime state into caller-owned storage without per-frame object allocation. */
export function resolveWorkbenchThreeWindowStateInto<Id extends string = string>(
  target: WorkbenchThreeWindowState<Id>,
  input: WorkbenchThreeWindowStateInput<Id>,
): WorkbenchThreeWindowState<Id> {
  const fullscreenId = input.fullscreenId ?? null;
  const blocked = input.blocked ?? false;
  const interactiveIds = mutableInteractiveIds(target.interactiveIds);
  interactiveIds.clear();
  let threeWindowCount = 0;
  let fullscreenThree = false;

  for (const source of input.windows) {
    const id = workbenchThreeWindowStateSourceId(source);
    if (!input.isThreeWindow(id as Id)) continue;
    threeWindowCount += 1;
    if (id === fullscreenId) fullscreenThree = true;
  }

  if (!blocked) {
    if (fullscreenThree && fullscreenId) {
      interactiveIds.add(fullscreenId);
    } else if (input.isThreeWindow(input.activeId)) {
      interactiveIds.add(input.activeId);
    }
  }

  target.activeId = input.activeId;
  target.fullscreenId = fullscreenId;
  target.fullscreenThree = fullscreenThree;
  target.live = !blocked && (fullscreenThree || threeWindowCount > 0);
  target.blocked = blocked;
  target.threeWindowCount = threeWindowCount;
  return target;
}

export function workbenchThreeWindowStateIsInteractive<Id extends string>(
  state: Pick<WorkbenchThreeWindowState<Id>, "interactiveIds">,
  id: Id,
): boolean {
  return state.interactiveIds.has(id);
}

/** Raises a fullscreen Three pane's runtime render-cell budget without mutating saved ASCII options. */
export function resolveWorkbenchThreeFullscreenAsciiOptions<TId extends string>(
  input: WorkbenchThreeFullscreenAsciiOptionsInput<TId>,
): ThreeAsciiConfigOptions {
  const fullscreenMinCells = Math.max(1, Math.floor(input.fullscreenMinCells));
  if (input.fullscreenId !== input.id || input.ascii.renderMaxCells >= fullscreenMinCells) {
    return input.ascii;
  }
  return {
    ...input.ascii,
    renderMaxCells: fullscreenMinCells,
  };
}

/** Resolves fullscreen target, active pressure cap, and runtime ASCII options for a Three workbench pane. */
export function resolveWorkbenchThreeRuntimeBudgetSnapshot<TId extends string>(
  input: WorkbenchThreeRuntimeBudgetSnapshotInput<TId>,
): WorkbenchThreeRuntimeBudgetSnapshot {
  const padding = input.fullscreenViewportPadding ?? {};
  const fullscreenThree = input.fullscreenId !== undefined && input.fullscreenId !== null &&
    (input.isThreeWindow?.(input.fullscreenId) ?? input.fullscreenId === input.id);
  const estimatedFullscreenViewport = {
    width: Math.max(0, input.viewport.width - Math.max(0, Math.floor(padding.columns ?? 0))),
    height: Math.max(0, input.viewport.height - Math.max(0, Math.floor(padding.rows ?? 0))),
  };
  const fullscreenViewport = fullscreenThree && input.liveViewport ? input.liveViewport : estimatedFullscreenViewport;
  const fullscreenViewportCells = Math.max(
    1,
    Math.floor(fullscreenViewport.width) * Math.floor(fullscreenViewport.height),
  );
  const fullscreenTargetCells = workbenchThreeFullscreenRenderCells(fullscreenViewport);
  const liveViewportTargetCells = input.liveViewport
    ? workbenchThreeLiveRenderCells(input.liveViewport)
    : WORKBENCH_THREE_LIVE_MAX_CELLS;
  const effectiveMaxCells = fullscreenThree
    ? apiWorkbenchThreeEffectiveMaxCells(input.fullscreenMaxCells, {
      fullscreenThree: true,
      fullscreenMinCells: fullscreenTargetCells,
    })
    : Math.max(liveViewportTargetCells, Math.floor(input.liveMaxCells));
  const runtimeAscii = fullscreenThree
    ? resolveWorkbenchThreeFullscreenAsciiOptions({
      id: input.id,
      fullscreenId: input.fullscreenId,
      ascii: input.ascii,
      fullscreenMinCells: fullscreenTargetCells,
    })
    : resolveWorkbenchThreeLiveAsciiOptions(input.ascii, effectiveMaxCells);
  return {
    fullscreenViewportCells,
    fullscreenTargetCells,
    effectiveMaxCells,
    runtimeAscii,
  };
}

export function resolveWorkbenchThreeLiveAsciiOptions(
  ascii: ThreeAsciiConfigOptions,
  liveMinCells: number,
): ThreeAsciiConfigOptions {
  const renderMaxCells = Math.max(1, Math.floor(liveMinCells));
  if (ascii.renderMaxCells >= renderMaxCells) return ascii;
  return {
    ...ascii,
    renderMaxCells,
  };
}

/** Raises tiled Three ASCII render cells to the pane's measured body size without mutating saved settings. */
export function resolveWorkbenchThreeTiledAsciiOptions(
  input: WorkbenchThreeTiledAsciiOptionsInput,
): ThreeAsciiConfigOptions {
  return resolveWorkbenchThreeLiveAsciiOptions(
    input.ascii,
    Math.max(
      Math.floor(input.liveMaxCells),
      workbenchThreeLiveRenderCells(input.liveViewport),
    ),
  );
}

/** Compares every persisted/runtime Three ASCII option field used by the workbench. */
export function sameWorkbenchThreeAsciiOptions(
  left: ThreeAsciiConfigOptions,
  right: ThreeAsciiConfigOptions,
): boolean {
  return left.preset === right.preset && left.border === right.border &&
    left.terminalGlyphStyle === right.terminalGlyphStyle &&
    left.terminalEdgeBias === right.terminalEdgeBias &&
    left.edgeThreshold === right.edgeThreshold &&
    left.normalThreshold === right.normalThreshold &&
    left.depthThreshold === right.depthThreshold &&
    left.exposure === right.exposure &&
    left.attenuation === right.attenuation &&
    left.blendWithBase === right.blendWithBase &&
    left.depthFalloff === right.depthFalloff &&
    left.depthOffset === right.depthOffset &&
    left.wireframeThickness === right.wireframeThickness &&
    left.renderMaxCells === right.renderMaxCells &&
    left.deferredReadbackSlots === right.deferredReadbackSlots &&
    left.edges === right.edges &&
    left.fill === right.fill &&
    left.invertLuminance === right.invertLuminance &&
    left.kittyGraphics === right.kittyGraphics &&
    left.kittyDisableAscii === right.kittyDisableAscii;
}

export const WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_RESCUE_CELLS, WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS],
  [WORKBENCH_THREE_EMERGENCY_CELLS, WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS],
  [120, 1000 / 15],
  [240, 1000 / 20],
  [480, 1000 / 20],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 20],
  [1_920, 1000 / 20],
  [3_840, 1000 / 20],
  [7_680, 1000 / 15],
  [15_400, 1000 / 15],
  [WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, 1000 / 12],
]);

export const WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_RESCUE_CELLS, 1000 / 8],
  [WORKBENCH_THREE_EMERGENCY_CELLS, 1000 / 8],
  [120, 1000 / 8],
  [240, 1000 / 8],
  [480, 1000 / 8],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 8],
  [1_920, 1000 / 6],
  [3_840, 1000 / 5],
  [7_680, 1000 / 4],
  [15_400, 1000 / 4],
  [WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, 1000 / 4],
]);

export type ApiWorkbenchThreePressurePolicy = Omit<
  WorkbenchThreeTerminalPressureOptions,
  "renderedThreeGrids" | "bytes" | "durationMs"
>;

export const API_WORKBENCH_THREE_PRESSURE_POLICY: ApiWorkbenchThreePressurePolicy = {
  levels: WORKBENCH_THREE_PRESSURE_LEVELS,
  highBytes: WORKBENCH_THREE_PRESSURE_HIGH_BYTES,
  lowBytes: WORKBENCH_THREE_PRESSURE_LOW_BYTES,
  highBytesPerGrid: WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_GRID,
  lowBytesPerGrid: WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_GRID,
  highBytesPerSecond: WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_SECOND,
  lowBytesPerSecond: WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_SECOND,
  highDurationMs: WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS,
  lowFpsRatio: WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO,
  minObservedFpsFrames: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  highFrameThreshold: WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD,
  lowFrameThreshold: WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD,
};

export const API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY: ApiWorkbenchThreePressurePolicy = {
  ...API_WORKBENCH_THREE_PRESSURE_POLICY,
  levels: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS,
  highBytes: Number.POSITIVE_INFINITY,
  highDurationMs: Number.POSITIVE_INFINITY,
  highBytesPerGrid: WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_GRID,
  lowBytesPerGrid: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_GRID,
  highBytesPerSecond: WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND,
  lowBytesPerSecond: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND,
};

export function apiWorkbenchThreeFrameIntervalForCells(cells: number, options: { live?: boolean } = {}): number {
  return workbenchThreeFrameIntervalForCells(cells, {
    live: options.live,
    liveIntervals: WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS,
    idleIntervals: WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS,
    liveDefaultMs: WORKBENCH_THREE_DRAW_INTERVAL_MS,
    idleDefaultMs: 1000 / 8,
  });
}

/** Resolves the active render-cell cap while a Three pane owns fullscreen. */
export function apiWorkbenchThreeEffectiveMaxCells(
  currentCells: number,
  _options: { fullscreenThree?: boolean; fullscreenMinCells?: number } = {},
): number {
  const current = Math.max(1, Math.floor(currentCells));
  return current;
}

/** Returns the runtime render-cell target for a fullscreen Three pane at the current terminal viewport size. */
export function workbenchThreeFullscreenRenderCells(
  rect: { width: number; height: number },
  options: { minCells?: number; maxCells?: number } = {},
): number {
  const minCells = Math.max(1, Math.floor(options.minCells ?? WORKBENCH_THREE_FULLSCREEN_MIN_CELLS));
  const maxCells = Math.max(minCells, Math.floor(options.maxCells ?? WORKBENCH_THREE_FULLSCREEN_MAX_CELLS));
  const area = Math.max(1, Math.floor(rect.width) * Math.floor(rect.height));
  return Math.min(maxCells, area);
}

/** Returns the runtime render-cell floor for a tiled live Three pane at its current body size. */
export function workbenchThreeLiveRenderCells(
  rect: { width: number; height: number },
  options: { minCells?: number; maxCells?: number; areaRatio?: number } = {},
): number {
  const minCells = Math.max(1, Math.floor(options.minCells ?? 480));
  const maxCells = Math.max(minCells, Math.floor(options.maxCells ?? WORKBENCH_THREE_FULLSCREEN_MIN_CELLS));
  const areaRatio = Math.min(1, Math.max(0.1, options.areaRatio ?? 1));
  const area = Math.max(1, Math.floor(rect.width) * Math.floor(rect.height));
  return Math.max(minCells, Math.min(maxCells, Math.floor(area * areaRatio)));
}

function workbenchThreeWindowStateSourceId<Id extends string>(source: WorkbenchThreeWindowStateSource<Id>): Id {
  return typeof source === "string" ? source : source.id;
}

function mutableInteractiveIds<Id extends string>(ids: ReadonlySet<Id>): Set<Id> {
  return ids as Set<Id>;
}
