import { type Canvas } from "../src/canvas/canvas.ts";
import { buildFallbackGrid, formatThreeAsciiFallbackDetail, ThreeAsciiObject } from "../src/canvas/three_ascii.ts";
import { Effect, Signal, SignalBatchScheduler, type SignalOfObject } from "../src/signals/mod.ts";
import { emptyStyle } from "../src/theme.ts";
import type { GraphicsHandle, GraphicsSurface, GraphicsSurfaceInspection } from "../src/runtime/graphics_surface.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { nextFrameDelay } from "../src/runtime/frame_timing.ts";
import {
  type ThreeAsciiImageFrame,
  ThreeAsciiRenderer,
  type ThreeAsciiRendererOptions,
  type ThreeAsciiRendererPerformance,
  type ThreeAsciiRenderFrame,
  type ThreeAsciiRenderFrameOptions,
} from "../src/three_ascii/renderer.ts";
import { asciiControlValues, asciiEffectOptions } from "./ascii_options.ts";
import { createNeonThreeScene, type NeonThreeSceneBundle } from "./neon_three.ts";
import { ThreePanelInteractionController, type ThreePanelInteractionState } from "./three_panel_interaction.ts";
import { resolveThreePanelLifecycleState, type ThreePanelLifecycleState } from "./three_panel_lifecycle.ts";
import type { AsciiOptions, Rect, ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

export type { ThreePanelInteractionState } from "./three_panel_interaction.ts";

const ADAPTIVE_RENDER_CELLS_MIN = 960;
const ADAPTIVE_RENDER_CELLS_SLOW_FRAMES = 2;
const ADAPTIVE_RENDER_CELLS_FAST_FRAMES = 120;

export interface ThreeSceneState {
  mode: ThreeSceneMode;
  signal: ThreeSceneSignal;
}

export interface ThreePanelRenderPolicyInput {
  ascii: Pick<AsciiOptions, "kittyGraphics" | "kittyDisableAscii">;
  graphicsAvailable: boolean;
  graphicsRectangle: Pick<Rect, "width" | "height">;
  rendererSupportsImage: boolean;
}

export interface ThreePanelRenderPolicy {
  kittyActive: boolean;
  renderAscii: boolean;
  renderImage: boolean;
  frameOptions: ThreeAsciiRenderFrameOptions;
}

export interface ThreePanelLifecycleInspection {
  state: ThreePanelLifecycleState;
  running: boolean;
  rendering: boolean;
  failed: boolean;
  disposed: boolean;
  hasRenderer: boolean;
  hasGraphicsHandle: boolean;
  destroyPending: boolean;
  rebuildPending: boolean;
  syncPending: boolean;
  frameGeneration: number;
}

export interface ThreePanelRenderSize {
  columns: number;
  rows: number;
}

export interface ThreePanelAdaptiveRenderBudgetInput {
  requestedMaxCells: number;
  currentMaxCells?: number;
  frameMs: number;
  targetMs: number;
  slowFrames: number;
  fastFrames: number;
}

export interface ThreePanelAdaptiveRenderBudgetResult {
  maxCells?: number;
  slowFrames: number;
  fastFrames: number;
  direction: "down" | "up" | "steady";
}

export function resolveThreePanelRenderSize(
  rect: Pick<Rect, "width" | "height">,
  maxCells?: number,
): ThreePanelRenderSize {
  const columns = Math.max(1, Math.floor(rect.width));
  const rows = Math.max(1, Math.floor(rect.height));
  const cellLimit = Math.max(1, Math.floor(maxCells ?? columns * rows));
  const cells = columns * rows;
  if (cells <= cellLimit) return { columns, rows };

  const scale = Math.sqrt(cellLimit / cells);
  return {
    columns: Math.max(1, Math.min(columns, Math.floor(columns * scale))),
    rows: Math.max(1, Math.min(rows, Math.floor(rows * scale))),
  };
}

/** Adjusts the Three ASCII render-cell budget from live frame timing without changing saved user settings. */
export function resolveThreePanelAdaptiveRenderBudget(
  input: ThreePanelAdaptiveRenderBudgetInput,
): ThreePanelAdaptiveRenderBudgetResult {
  const requestedMaxCells = Math.max(ADAPTIVE_RENDER_CELLS_MIN, Math.floor(input.requestedMaxCells));
  const currentMaxCells = Math.max(
    ADAPTIVE_RENDER_CELLS_MIN,
    Math.min(requestedMaxCells, Math.floor(input.currentMaxCells ?? requestedMaxCells)),
  );
  const budgetSteps = asciiControlValues("renderMaxCells")
    .filter((value) => value >= ADAPTIVE_RENDER_CELLS_MIN && value <= requestedMaxCells)
    .sort((a, b) => a - b);
  const steps = budgetSteps.length ? budgetSteps : [requestedMaxCells];
  const slowThreshold = Math.max(100, input.targetMs * 1.8);
  const fastThreshold = Math.max(1, input.targetMs * 0.7);

  if (input.frameMs >= slowThreshold) {
    const slowFrames = input.slowFrames + 1;
    if (slowFrames >= ADAPTIVE_RENDER_CELLS_SLOW_FRAMES) {
      const lower = previousRenderCellStep(steps, currentMaxCells);
      if (lower < currentMaxCells) {
        return { maxCells: lower, slowFrames: 0, fastFrames: 0, direction: "down" };
      }
    }
    return { maxCells: input.currentMaxCells, slowFrames, fastFrames: 0, direction: "steady" };
  }

  if (input.currentMaxCells !== undefined && currentMaxCells < requestedMaxCells && input.frameMs <= fastThreshold) {
    const fastFrames = input.fastFrames + 1;
    if (fastFrames >= ADAPTIVE_RENDER_CELLS_FAST_FRAMES) {
      const higher = nextRenderCellStep(steps, currentMaxCells);
      return {
        maxCells: higher >= requestedMaxCells ? undefined : higher,
        slowFrames: 0,
        fastFrames: 0,
        direction: "up",
      };
    }
    return { maxCells: input.currentMaxCells, slowFrames: 0, fastFrames, direction: "steady" };
  }

  return { maxCells: input.currentMaxCells, slowFrames: 0, fastFrames: 0, direction: "steady" };
}

function previousRenderCellStep(steps: readonly number[], current: number): number {
  let previous = steps[0] ?? current;
  for (const step of steps) {
    if (step >= current) return previous;
    previous = step;
  }
  return previous;
}

function nextRenderCellStep(steps: readonly number[], current: number): number {
  for (const step of steps) {
    if (step > current) return step;
  }
  return steps.at(-1) ?? current;
}

export interface ThreePanelGridRenderer {
  setSize(columns: number, rows: number): void;
  setEffectOptions(options: ReturnType<typeof asciiEffectOptions>): void;
  setTerminalEdgeBias(value: number): void;
  setTerminalGlyphStyle(value: AsciiOptions["terminalGlyphStyle"]): void;
  renderToAnsiGrid(deltaTime?: number, onFrame?: (deltaTime: number) => void | Promise<void>): Promise<string[][]>;
  renderFrame?(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options?: ThreeAsciiRenderFrameOptions,
  ): Promise<ThreeAsciiRenderFrame>;
  inspectPerformance?(): ThreeAsciiRendererPerformance | undefined;
  destroy(): void;
}

export type ThreePanelRendererFactory = (options: ThreeAsciiRendererOptions) => ThreePanelGridRenderer;

export function resolveThreePanelRenderPolicy(input: ThreePanelRenderPolicyInput): ThreePanelRenderPolicy {
  const kittyRequested = input.ascii.kittyGraphics;
  const kittyActive = Boolean(
    kittyRequested && input.graphicsAvailable && input.rendererSupportsImage &&
      input.graphicsRectangle.width > 0 && input.graphicsRectangle.height > 0,
  );
  const renderAscii = !kittyActive || !input.ascii.kittyDisableAscii;
  return {
    kittyActive,
    renderAscii,
    renderImage: kittyActive,
    frameOptions: {
      ansi: renderAscii,
      image: kittyActive,
    },
  };
}

export class ThreePanelView {
  private object?: ThreeAsciiObject;
  private bundle?: NeonThreeSceneBundle;
  private activeMode?: ThreeSceneMode;
  private activeWireframeThickness?: number;
  private readonly effect: Effect;
  private readonly onUpdate?: () => void;
  private readonly interaction = new ThreePanelInteractionController();

  constructor(options: {
    canvas: Canvas;
    rectangle: SignalOfObject<Rect>;
    scene: SignalOfObject<ThreeSceneState | null>;
    ascii: SignalOfObject<AsciiOptions>;
    enabled?: boolean | Signal<boolean>;
    zIndex: number;
    frameInterval?: number;
    onUpdate?: () => void;
  }) {
    this.onUpdate = options.onUpdate;
    this.effect = new Effect(() => {
      const rect = options.rectangle.value;
      const current = options.scene.value;
      const ascii = options.ascii.value;
      const enabled = options.enabled instanceof Signal ? options.enabled.value : options.enabled ?? true;
      const visible = enabled && !!current && rect.width > 0 && rect.height > 0;

      if (!visible || !current) {
        this.destroy();
        return;
      }

      if (
        !this.object || this.activeMode !== current.mode ||
        this.activeWireframeThickness !== ascii.wireframeThickness ||
        !this.object.isOperational()
      ) {
        this.destroy();
        const bundle = createNeonThreeScene(current.mode, { wireframeThickness: ascii.wireframeThickness });
        this.bundle = bundle;
        this.activeMode = current.mode;
        this.activeWireframeThickness = ascii.wireframeThickness;
        this.interaction.captureBaseTransform(bundle);
        this.object = new ThreeAsciiObject({
          canvas: options.canvas,
          rectangle: options.rectangle,
          zIndex: options.zIndex,
          style: emptyStyle,
          scene: bundle.scene,
          camera: bundle.camera,
          frameInterval: options.frameInterval ?? 1000 / 10,
          effect: asciiEffectOptions(ascii),
          terminalEdgeBias: ascii.terminalEdgeBias,
          terminalGlyphStyle: ascii.terminalGlyphStyle,
          onFrame: () => {
            const latest = options.scene.peek();
            if (!latest) {
              return;
            }
            bundle.tick(performance.now(), latest.signal);
            this.interaction.apply(this.bundle);
          },
        });
        this.interaction.apply(this.bundle);
        this.object.draw();
        return;
      }

      this.object.setEffectOptions(asciiEffectOptions(ascii));
      this.object.setTerminalEdgeBias(ascii.terminalEdgeBias);
      this.object.setTerminalGlyphStyle(ascii.terminalGlyphStyle);
    });
  }

  rotateBy(deltaColumns: number, deltaRows: number): ThreePanelInteractionState {
    if (deltaColumns === 0 && deltaRows === 0) return this.inspectInteraction();
    const state = this.interaction.rotateBy(deltaColumns, deltaRows);
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  zoomBy(scrollSteps: number): ThreePanelInteractionState {
    if (scrollSteps === 0) return this.inspectInteraction();
    const state = this.interaction.zoomBy(scrollSteps);
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  resetInteraction(): ThreePanelInteractionState {
    const state = this.interaction.reset();
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  inspectInteraction(): ThreePanelInteractionState {
    return this.interaction.inspect();
  }

  private destroy() {
    this.object?.erase();
    this.object = undefined;
    this.bundle?.dispose();
    this.bundle = undefined;
    this.activeMode = undefined;
    this.activeWireframeThickness = undefined;
    this.interaction.clearBaseTransform();
  }

  dispose(): void {
    this.effect.dispose();
    this.destroy();
  }
}

export class ThreePanelFrameView {
  readonly grid = new Signal<string[][]>([]);

  private renderer?: ThreePanelGridRenderer;
  private bundle?: NeonThreeSceneBundle;
  private activeMode?: ThreeSceneMode;
  private activeWireframeThickness?: number;
  private readonly syncCallback = () => this.sync();
  private readonly effect: Effect;
  private readonly syncScheduler = new SignalBatchScheduler();
  private readonly frameInterval: number;
  private readonly onUpdate?: () => void;
  private lastFrameTime = performance.now();
  private rendering = false;
  private running = false;
  private destroyPending = false;
  private rebuildPending = false;
  private syncPending = false;
  private failed = false;
  private disposed = false;
  private frameGeneration = 0;
  private frameTimer?: ReturnType<typeof setTimeout>;
  private readonly interaction = new ThreePanelInteractionController();
  private graphicsHandle?: GraphicsHandle;
  private lastGraphicsUnavailableKey?: string;
  private appliedColumns = 0;
  private appliedRows = 0;
  private appliedEffectOptions?: ReturnType<typeof asciiEffectOptions>;
  private appliedTerminalEdgeBias?: number;
  private appliedTerminalGlyphStyle?: AsciiOptions["terminalGlyphStyle"];
  private blankGridCache: string[][] = [];
  private blankGridColumns = -1;
  private blankGridRows = -1;
  private lastSlowFrameReportTime = 0;
  private adaptiveRenderMaxCells?: number;
  private adaptiveRequestedMaxCells = 0;
  private adaptiveSlowFrames = 0;
  private adaptiveFastFrames = 0;
  private gridFingerprint = "";

  constructor(
    private readonly options: {
      rectangle: SignalOfObject<Rect>;
      scene: SignalOfObject<ThreeSceneState | null>;
      ascii: SignalOfObject<AsciiOptions>;
      enabled?: boolean | Signal<boolean>;
      graphicsSurface?: GraphicsSurface | (() => GraphicsSurface | null | undefined);
      graphicsRectangle?: SignalOfObject<Rect>;
      diagnostics?: DiagnosticsCollector;
      frameInterval?: number;
      maxRenderCells?: number;
      onUpdate?: () => void;
      rendererFactory?: ThreePanelRendererFactory;
    },
  ) {
    this.frameInterval = options.frameInterval ?? 1000 / 10;
    this.onUpdate = options.onUpdate;
    this.effect = new Effect(() => {
      void options.rectangle.value;
      void options.scene.value;
      void options.ascii.value;
      if (options.enabled instanceof Signal) void options.enabled.value;
      this.scheduleSync();
    });
    this.scheduleSync();
  }

  isOperational(): boolean {
    return !this.failed;
  }

  inspectLifecycle(): ThreePanelLifecycleInspection {
    return {
      state: this.lifecycleState(),
      running: this.running,
      rendering: this.rendering,
      failed: this.failed,
      disposed: this.disposed,
      hasRenderer: this.renderer !== undefined,
      hasGraphicsHandle: this.graphicsHandle !== undefined,
      destroyPending: this.destroyPending,
      rebuildPending: this.rebuildPending,
      syncPending: this.syncPending,
      frameGeneration: this.frameGeneration,
    };
  }

  inspectPerformance(): ThreeAsciiRendererPerformance | undefined {
    return this.renderer?.inspectPerformance?.();
  }

  private sync(): void {
    if (this.disposed) return;

    const rect = this.options.rectangle.value;
    const current = this.options.scene.value;
    const ascii = this.options.ascii.value;
    const enabled = this.options.enabled instanceof Signal ? this.options.enabled.value : this.options.enabled ?? true;
    const visible = enabled && !!current && rect.width > 0 && rect.height > 0;

    if (!visible || !current) {
      this.invalidateFrame();
      this.syncPending = false;
      this.rebuildPending = false;
      this.destroyRenderer();
      void this.clearGraphicsImage();
      this.setGrid([]);
      return;
    }

    const needsRenderer = !this.renderer ||
      this.activeMode !== current.mode ||
      this.activeWireframeThickness !== ascii.wireframeThickness ||
      !this.isOperational();

    if (needsRenderer) {
      if (this.rendering) {
        this.invalidateFrame();
        this.running = false;
        this.destroyPending = true;
        this.rebuildPending = true;
        return;
      }

      this.destroyRenderer();
      const bundle = createNeonThreeScene(current.mode, { wireframeThickness: ascii.wireframeThickness });
      this.bundle = bundle;
      this.activeMode = current.mode;
      this.activeWireframeThickness = ascii.wireframeThickness;
      this.interaction.captureBaseTransform(bundle);
      this.failed = false;
      const rendererFactory = this.options.rendererFactory ??
        ((rendererOptions) => new ThreeAsciiRenderer({ ...rendererOptions, readbackStrategy: "deferred" }));
      const effectOptions = asciiEffectOptions(ascii);
      this.renderer = rendererFactory({
        scene: bundle.scene,
        camera: bundle.camera,
        ...this.renderSizeFor(rect, ascii),
        effect: effectOptions,
        terminalEdgeBias: ascii.terminalEdgeBias,
        terminalGlyphStyle: ascii.terminalGlyphStyle,
      });
      this.captureAppliedRendererState(rect, ascii, effectOptions);
      const renderSize = this.renderSizeFor(rect, ascii);
      this.setGrid(
        buildFallbackGrid(renderSize.columns, renderSize.rows, "INITIALIZING", "ASCII RENDERER STARTING"),
      );
    }

    if (this.rendering) {
      this.invalidateFrame();
      this.running = false;
      this.syncPending = true;
      return;
    }

    if (this.renderer) {
      this.applyRendererState(this.renderer, rect, ascii);
    }

    if (!this.running) {
      this.running = true;
      queueMicrotask(() => void this.renderLoop());
    }
  }

  private isVisible(): boolean {
    const rect = this.options.rectangle.peek();
    const current = this.options.scene.peek();
    const enabled = this.options.enabled instanceof Signal ? this.options.enabled.peek() : this.options.enabled ?? true;
    return enabled && !!current && rect.width > 0 && rect.height > 0;
  }

  private lifecycleState(): ThreePanelLifecycleState {
    return resolveThreePanelLifecycleState({
      disposed: this.disposed,
      failed: this.failed,
      destroyPending: this.destroyPending,
      rebuildPending: this.rebuildPending,
      syncPending: this.syncPending,
      rendering: this.rendering,
      hasRenderer: this.renderer !== undefined,
      visible: this.isVisible(),
      gridRows: this.grid.peek().length,
    });
  }

  private async renderLoop(): Promise<void> {
    if (!this.running || this.rendering) return;
    this.frameTimer = undefined;

    const renderer = this.renderer;
    const bundle = this.bundle;
    if (!renderer || !bundle) return;

    const frameGeneration = this.frameGeneration;
    this.rendering = true;
    const frameStartedAt = performance.now();

    try {
      const rect = this.options.rectangle.peek();
      const current = this.options.scene.peek();
      if (!current || rect.width <= 0 || rect.height <= 0) {
        this.setGrid([]);
        return;
      }

      const deltaTime = (frameStartedAt - this.lastFrameTime) / 1000;
      this.lastFrameTime = frameStartedAt;

      const ascii = this.options.ascii.peek();
      this.applyRendererState(renderer, rect, ascii);
      const graphicsSurface = this.resolveGraphicsSurface();
      const graphicsRectangle = this.options.graphicsRectangle?.peek() ?? rect;
      const graphicsInspection = graphicsSurface?.inspect();
      const policy = resolveThreePanelRenderPolicy({
        ascii,
        graphicsAvailable: graphicsInspection?.available ?? false,
        graphicsRectangle,
        rendererSupportsImage: typeof renderer.renderFrame === "function",
      });
      this.reportGraphicsFallback(ascii, graphicsInspection, graphicsRectangle, renderer, policy);
      const onFrame = () => {
        const latest = this.options.scene.peek();
        if (!latest) return;
        bundle.tick(performance.now(), latest.signal);
        this.interaction.apply(this.bundle);
      };
      const frame = policy.kittyActive && renderer.renderFrame
        ? await renderer.renderFrame(deltaTime, onFrame, policy.frameOptions)
        : { grid: await renderer.renderToAnsiGrid(deltaTime, onFrame) };

      if (!this.isCurrentFrame(frameGeneration, renderer, bundle)) {
        return;
      }

      if (policy.renderImage && frame.image && graphicsSurface) {
        await this.putGraphicsImage(graphicsSurface, frame.image, graphicsRectangle, frameGeneration);
      } else {
        await this.clearGraphicsImage();
      }

      if (!this.isCurrentFrame(frameGeneration, renderer, bundle)) {
        return;
      }

      this.failed = false;
      const renderSize = this.renderSizeFor(rect, ascii);
      this.setGrid(
        policy.renderAscii ? frame.grid ?? [] : this.blankGridFor(renderSize.columns, renderSize.rows),
        policy.renderAscii,
      );
      this.updateAdaptiveRenderBudget(renderer, ascii);
      this.reportSlowFrame(renderer);
    } catch (error) {
      if (!this.ownsFrame(frameGeneration, renderer, bundle)) {
        return;
      }
      this.failed = true;
      this.running = false;
      await this.clearGraphicsImage();
      const rect = this.options.rectangle.peek();
      const renderSize = this.renderSizeFor(rect, this.options.ascii.peek());
      this.setGrid(buildFallbackGrid(renderSize.columns, renderSize.rows, formatThreeAsciiFallbackDetail(error)));
      this.destroyPending = true;
    } finally {
      this.rendering = false;

      if (this.destroyPending) {
        this.destroyPending = false;
        this.destroyRenderer();
      }

      if (this.rebuildPending || this.syncPending) {
        this.rebuildPending = false;
        this.syncPending = false;
        this.scheduleSync();
      } else if (this.running) {
        this.frameTimer = setTimeout(
          () => void this.renderLoop(),
          nextFrameDelay(this.frameInterval, frameStartedAt, performance.now()),
        );
      }
    }
  }

  private reportSlowFrame(renderer: ThreePanelGridRenderer): void {
    const performanceInfo = renderer.inspectPerformance?.();
    if (!performanceInfo) return;
    const now = performance.now();
    const targetMs = Math.max(1, this.frameInterval);
    const slowThreshold = Math.max(80, targetMs * 1.5);
    if (performanceInfo.totalMs < slowThreshold || now - this.lastSlowFrameReportTime < 2_000) return;
    this.lastSlowFrameReportTime = now;
    this.options.diagnostics?.report({
      source: "three-panel",
      code: "three-ascii-slow-frame",
      severity: "debug",
      message: `Three ASCII frame ${
        performanceInfo.totalMs.toFixed(1)
      }ms at ${performanceInfo.columns}x${performanceInfo.rows}`,
      detail: `scene ${performanceInfo.sceneMs.toFixed(1)}ms, ansi ${performanceInfo.ansiMs.toFixed(1)}ms, readback ${
        performanceInfo.readbackMs.toFixed(1)
      }ms, assembly ${performanceInfo.assemblyMs.toFixed(1)}ms`,
      context: {
        columns: performanceInfo.columns,
        rows: performanceInfo.rows,
        cells: performanceInfo.cells,
        glyphStyle: performanceInfo.terminalGlyphStyle,
        totalMs: Math.round(performanceInfo.totalMs * 10) / 10,
        sceneMs: Math.round(performanceInfo.sceneMs * 10) / 10,
        ansiMs: Math.round(performanceInfo.ansiMs * 10) / 10,
        readbackMs: Math.round(performanceInfo.readbackMs * 10) / 10,
        assemblyMs: Math.round(performanceInfo.assemblyMs * 10) / 10,
      },
    });
  }

  private updateAdaptiveRenderBudget(
    renderer: ThreePanelGridRenderer,
    ascii: Pick<AsciiOptions, "renderMaxCells">,
  ): void {
    const performanceInfo = renderer.inspectPerformance?.();
    if (!performanceInfo) return;
    const requestedMaxCells = this.requestedRenderMaxCells(ascii);
    const next = resolveThreePanelAdaptiveRenderBudget({
      requestedMaxCells,
      currentMaxCells: this.adaptiveRenderMaxCells,
      frameMs: performanceInfo.totalMs,
      targetMs: this.frameInterval,
      slowFrames: this.adaptiveSlowFrames,
      fastFrames: this.adaptiveFastFrames,
    });

    this.adaptiveSlowFrames = next.slowFrames;
    this.adaptiveFastFrames = next.fastFrames;
    if (next.maxCells === this.adaptiveRenderMaxCells) return;

    this.adaptiveRenderMaxCells = next.maxCells;
    this.invalidateFrame();
    this.running = false;
    this.syncPending = true;
    if (next.direction === "steady") return;

    const maxCells = next.maxCells ?? requestedMaxCells;
    this.options.diagnostics?.report({
      source: "three-panel",
      code: "three-ascii-adaptive-render-cells",
      severity: "debug",
      message: `Three ASCII render budget ${next.direction === "down" ? "reduced" : "raised"} to ${maxCells} cells.`,
      detail: `frame ${performanceInfo.totalMs.toFixed(1)}ms, target ${this.frameInterval.toFixed(1)}ms`,
      context: {
        direction: next.direction,
        maxCells,
        requestedMaxCells,
        frameMs: Math.round(performanceInfo.totalMs * 10) / 10,
        targetMs: Math.round(this.frameInterval * 10) / 10,
      },
    });
  }

  private scheduleSync(): void {
    if (this.disposed) return;
    this.syncScheduler.schedule(this.syncCallback);
  }

  private setGrid(grid: string[][], forceUpdate = false): void {
    if (this.disposed) return;
    if (!forceUpdate && this.grid.peek() === grid) return;
    const fingerprint = fingerprintGrid(grid);
    if (this.gridFingerprint === fingerprint) return;
    this.gridFingerprint = fingerprint;
    this.grid.jink(grid);
    this.onUpdate?.();
  }

  private blankGridFor(columns: number, rows: number): string[][] {
    if (this.blankGridColumns === columns && this.blankGridRows === rows) return this.blankGridCache;
    this.blankGridColumns = columns;
    this.blankGridRows = rows;
    this.blankGridCache = blankGrid(columns, rows);
    return this.blankGridCache;
  }

  private invalidateFrame(): void {
    this.frameGeneration += 1;
  }

  private ownsFrame(
    generation: number,
    renderer: ThreePanelGridRenderer,
    bundle: NeonThreeSceneBundle,
  ): boolean {
    return !this.disposed && this.frameGeneration === generation && this.renderer === renderer &&
      this.bundle === bundle;
  }

  private isCurrentFrame(
    generation: number,
    renderer: ThreePanelGridRenderer,
    bundle: NeonThreeSceneBundle,
  ): boolean {
    return this.running && this.ownsFrame(generation, renderer, bundle);
  }

  rotateBy(deltaColumns: number, deltaRows: number): ThreePanelInteractionState {
    if (deltaColumns === 0 && deltaRows === 0) return this.inspectInteraction();
    const state = this.interaction.rotateBy(deltaColumns, deltaRows);
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  zoomBy(scrollSteps: number): ThreePanelInteractionState {
    if (scrollSteps === 0) return this.inspectInteraction();
    const state = this.interaction.zoomBy(scrollSteps);
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  resetInteraction(): ThreePanelInteractionState {
    const state = this.interaction.reset();
    this.interaction.apply(this.bundle);
    this.onUpdate?.();
    return state;
  }

  inspectInteraction(): ThreePanelInteractionState {
    return this.interaction.inspect();
  }

  private destroyRenderer(): void {
    this.invalidateFrame();
    this.running = false;
    if (this.frameTimer !== undefined) {
      clearTimeout(this.frameTimer);
      this.frameTimer = undefined;
    }

    if (this.rendering) {
      this.destroyPending = true;
      return;
    }

    this.renderer?.destroy();
    this.renderer = undefined;
    this.resetAppliedRendererState();
    void this.clearGraphicsImage();
    this.bundle?.dispose();
    this.bundle = undefined;
    this.activeMode = undefined;
    this.activeWireframeThickness = undefined;
    this.interaction.clearBaseTransform();
  }

  private resetAppliedRendererState(): void {
    this.appliedColumns = 0;
    this.appliedRows = 0;
    this.appliedEffectOptions = undefined;
    this.appliedTerminalEdgeBias = undefined;
    this.appliedTerminalGlyphStyle = undefined;
  }

  private captureAppliedRendererState(
    rect: Pick<Rect, "width" | "height">,
    ascii: AsciiOptions,
    effectOptions = asciiEffectOptions(ascii),
  ): void {
    const renderSize = this.renderSizeFor(rect, ascii);
    this.appliedColumns = renderSize.columns;
    this.appliedRows = renderSize.rows;
    this.appliedEffectOptions = effectOptions;
    this.appliedTerminalEdgeBias = ascii.terminalEdgeBias;
    this.appliedTerminalGlyphStyle = ascii.terminalGlyphStyle;
  }

  private applyRendererState(
    renderer: ThreePanelGridRenderer,
    rect: Pick<Rect, "width" | "height">,
    ascii: AsciiOptions,
  ) {
    const { columns, rows } = this.renderSizeFor(rect, ascii);
    if (this.appliedColumns !== columns || this.appliedRows !== rows) {
      renderer.setSize(columns, rows);
      this.appliedColumns = columns;
      this.appliedRows = rows;
    }

    const effectOptions = asciiEffectOptions(ascii);
    if (!threeAsciiEffectOptionsEqual(this.appliedEffectOptions, effectOptions)) {
      renderer.setEffectOptions(effectOptions);
      this.appliedEffectOptions = effectOptions;
    }

    if (this.appliedTerminalEdgeBias !== ascii.terminalEdgeBias) {
      renderer.setTerminalEdgeBias(ascii.terminalEdgeBias);
      this.appliedTerminalEdgeBias = ascii.terminalEdgeBias;
    }

    if (this.appliedTerminalGlyphStyle !== ascii.terminalGlyphStyle) {
      renderer.setTerminalGlyphStyle(ascii.terminalGlyphStyle);
      this.appliedTerminalGlyphStyle = ascii.terminalGlyphStyle;
    }
  }

  private renderSizeFor(
    rect: Pick<Rect, "width" | "height">,
    ascii: Pick<AsciiOptions, "renderMaxCells">,
  ): ThreePanelRenderSize {
    const requested = this.requestedRenderMaxCells(ascii);
    if (requested !== this.adaptiveRequestedMaxCells) {
      this.adaptiveRequestedMaxCells = requested;
      this.adaptiveRenderMaxCells = undefined;
      this.adaptiveSlowFrames = 0;
      this.adaptiveFastFrames = 0;
    }
    return resolveThreePanelRenderSize(rect, this.adaptiveRenderMaxCells ?? requested);
  }

  private requestedRenderMaxCells(ascii: Pick<AsciiOptions, "renderMaxCells">): number {
    return Math.max(1, Math.floor(this.options.maxRenderCells ?? ascii.renderMaxCells));
  }

  dispose(): void {
    this.disposed = true;
    this.syncPending = false;
    this.rebuildPending = false;
    this.syncScheduler.cancel();
    this.effect.dispose();
    this.destroyRenderer();
    void this.clearGraphicsImage();
    this.grid.dispose();
  }

  private resolveGraphicsSurface(): GraphicsSurface | undefined {
    const configured = this.options.graphicsSurface;
    return typeof configured === "function" ? configured() ?? undefined : configured;
  }

  private reportGraphicsFallback(
    ascii: Pick<AsciiOptions, "kittyGraphics" | "kittyDisableAscii">,
    inspection: GraphicsSurfaceInspection | undefined,
    rect: Pick<Rect, "width" | "height">,
    renderer: ThreePanelGridRenderer,
    policy: ThreePanelRenderPolicy,
  ): void {
    if (!ascii.kittyGraphics || policy.kittyActive) {
      this.lastGraphicsUnavailableKey = undefined;
      return;
    }

    const reason = graphicsFallbackReason(inspection, rect, renderer);
    const key = `${reason}|${inspection?.reason ?? ""}|${ascii.kittyDisableAscii ? "kitty-only" : "dual"}`;
    if (key === this.lastGraphicsUnavailableKey) return;
    this.lastGraphicsUnavailableKey = key;

    this.options.diagnostics?.report({
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
        kittyDisableAscii: ascii.kittyDisableAscii,
      },
    });
  }

  private async putGraphicsImage(
    surface: GraphicsSurface,
    image: ThreeAsciiImageFrame,
    rect: Rect,
    frameGeneration: number,
  ): Promise<void> {
    if (this.disposed || rect.width <= 0 || rect.height <= 0) return;
    if (this.graphicsHandle) {
      await this.deleteGraphicsImage(surface, this.graphicsHandle, "replace");
      this.graphicsHandle = undefined;
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
    if (this.disposed || this.frameGeneration !== frameGeneration) {
      await this.deleteGraphicsImage(surface, handle, "stale-frame");
      return;
    }
    this.graphicsHandle = handle;
  }

  private async clearGraphicsImage(): Promise<void> {
    const handle = this.graphicsHandle;
    if (!handle) return;
    this.graphicsHandle = undefined;
    const surface = this.resolveGraphicsSurface();
    if (!surface) return;
    await this.deleteGraphicsImage(surface, handle, "clear");
  }

  private async deleteGraphicsImage(
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

function blankGrid(width: number, height: number): string[][] {
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

function fingerprintGrid(grid: readonly (readonly string[] | undefined)[]): string {
  let hash = 2166136261;
  const mix = (value: number) => {
    hash ^= value;
    hash = Math.imul(hash, 16777619) >>> 0;
  };

  mix(grid.length);
  for (const row of grid) {
    const columns = row?.length ?? 0;
    mix(columns);
    if (!row) continue;
    for (const cell of row) {
      mix(cell.length);
      for (let index = 0; index < cell.length; index += 1) {
        mix(cell.charCodeAt(index));
      }
    }
  }
  return `${grid.length}:${hash.toString(36)}`;
}

function threeAsciiEffectOptionsEqual(
  left: ReturnType<typeof asciiEffectOptions> | undefined,
  right: ReturnType<typeof asciiEffectOptions>,
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

function graphicsFallbackReason(
  inspection: GraphicsSurfaceInspection | undefined,
  rect: Pick<Rect, "width" | "height">,
  renderer: ThreePanelGridRenderer,
): string {
  if (!inspection) return "missing-surface";
  if (!inspection.available) return inspection.reason ?? "surface-unavailable";
  if (rect.width <= 0 || rect.height <= 0) return "empty-graphics-rectangle";
  if (typeof renderer.renderFrame !== "function") return "renderer-image-frame-unsupported";
  return "inactive";
}
