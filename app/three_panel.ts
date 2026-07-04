import { type Canvas } from "../src/canvas/canvas.ts";
import { buildFallbackGrid, formatThreeAsciiFallbackDetail, ThreeAsciiObject } from "../src/canvas/three_ascii.ts";
import { Effect, Signal, SignalBatchScheduler, type SignalOfObject } from "../src/signals/mod.ts";
import { emptyStyle } from "../src/theme.ts";
import type { GraphicsSurface, GraphicsSurfaceInspection } from "../src/runtime/graphics_surface.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { nextFrameDelay } from "../src/runtime/frame_timing.ts";
import {
  ThreeAsciiRenderer,
  type ThreeAsciiRendererOptions,
  type ThreeAsciiRendererPerformance,
  type ThreeAsciiRenderFrame,
  type ThreeAsciiRenderFrameOptions,
} from "../src/three_ascii/renderer.ts";
import type { ThreeAsciiReadbackStrategy } from "../src/three_ascii/renderer_options.ts";
import { asciiEffectOptions } from "./ascii_options.ts";
import { createNeonThreeScene, type NeonThreeSceneBundle } from "./neon_three.ts";
import { ThreePanelGraphicsImageController } from "./three_panel_graphics.ts";
import { ThreePanelInteractionController, type ThreePanelInteractionState } from "./three_panel_interaction.ts";
import { resolveThreePanelLifecycleState, type ThreePanelLifecycleState } from "./three_panel_lifecycle.ts";
import {
  threePanelAdaptiveRenderCellsDiagnostic,
  threePanelGraphicsFallbackDiagnostic,
  threePanelGraphicsFallbackReason,
  threePanelSlowFrameDiagnostic,
} from "./three_panel_diagnostics.ts";
import {
  resolveThreePanelAdaptiveRenderBudget,
  ThreePanelAdaptiveRenderBudgetController,
} from "./three_panel_adaptive.ts";
import { threePanelAsciiEffectOptionsEqual, threePanelRendererStateMatches } from "./three_panel_effect.ts";
import { fingerprintThreePanelGrid, threePanelBlankGrid } from "./three_panel_grid.ts";
import {
  resolveThreePanelFrameInterval,
  resolveThreePanelRenderPolicy,
  resolveThreePanelRenderSize,
  resolveThreePanelRequestedMaxCells,
  type ThreePanelRenderPolicy,
  type ThreePanelRenderSize,
} from "./three_panel_policy.ts";
import { defaultThreePanelRenderQueue, ThreePanelRenderQueue } from "./three_panel_render_queue.ts";
import type { AsciiOptions, Rect, ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

export type { ThreePanelInteractionState } from "./three_panel_interaction.ts";
export {
  resolveThreePanelAdaptiveRenderBudget,
  ThreePanelAdaptiveRenderBudgetController,
  type ThreePanelAdaptiveRenderBudgetInput,
  type ThreePanelAdaptiveRenderBudgetResult,
  type ThreePanelAdaptiveRenderBudgetUpdateInput,
  type ThreePanelAdaptiveRenderBudgetUpdateResult,
} from "./three_panel_adaptive.ts";
export {
  resolveThreePanelFrameInterval,
  resolveThreePanelRenderPolicy,
  resolveThreePanelRenderSize,
  resolveThreePanelRequestedMaxCells,
  type ThreePanelRenderPolicy,
  type ThreePanelRenderPolicyInput,
  type ThreePanelRenderSize,
} from "./three_panel_policy.ts";
export { defaultThreePanelRenderQueue, ThreePanelRenderQueue } from "./three_panel_render_queue.ts";

export interface ThreeSceneState {
  mode: ThreeSceneMode;
  signal: ThreeSceneSignal;
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

type ThreePanelLiveValue = boolean | Signal<boolean> | (() => boolean);
type ThreePanelIntervalValue = number | Signal<number>;
type ThreePanelRenderCellsValue = number | Signal<number>;

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
  private activeDeferredReadbackSlots?: number;
  private readonly syncCallback = () => this.sync();
  private readonly effect: Effect;
  private readonly syncScheduler = new SignalBatchScheduler();
  private readonly frameInterval: ThreePanelIntervalValue;
  private readonly idleFrameInterval?: ThreePanelIntervalValue;
  private readonly interactive?: ThreePanelLiveValue;
  private readonly renderQueue: ThreePanelRenderQueue;
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
  private readonly graphics: ThreePanelGraphicsImageController;
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
  private readonly adaptiveBudget = new ThreePanelAdaptiveRenderBudgetController();
  private gridFingerprint = "";
  private gridRevision?: number;

  constructor(
    private readonly options: {
      rectangle: SignalOfObject<Rect>;
      scene: SignalOfObject<ThreeSceneState | null>;
      ascii: SignalOfObject<AsciiOptions>;
      enabled?: boolean | Signal<boolean>;
      graphicsSurface?: GraphicsSurface | (() => GraphicsSurface | null | undefined);
      graphicsRectangle?: SignalOfObject<Rect>;
      diagnostics?: DiagnosticsCollector;
      frameInterval?: ThreePanelIntervalValue;
      idleFrameInterval?: ThreePanelIntervalValue;
      interactive?: ThreePanelLiveValue;
      maxRenderCells?: ThreePanelRenderCellsValue;
      idleMaxRenderCells?: ThreePanelRenderCellsValue;
      readbackStrategy?: ThreeAsciiReadbackStrategy;
      renderQueue?: ThreePanelRenderQueue;
      onUpdate?: () => void;
      rendererFactory?: ThreePanelRendererFactory;
    },
  ) {
    this.frameInterval = options.frameInterval ?? 1000 / 10;
    this.idleFrameInterval = options.idleFrameInterval;
    this.interactive = options.interactive;
    this.renderQueue = options.renderQueue ?? defaultThreePanelRenderQueue;
    this.onUpdate = options.onUpdate;
    this.graphics = new ThreePanelGraphicsImageController({
      diagnostics: options.diagnostics,
      currentGeneration: () => this.frameGeneration,
      disposed: () => this.disposed,
    });
    this.effect = new Effect(() => {
      void options.rectangle.value;
      void options.scene.value;
      void options.ascii.value;
      if (options.enabled instanceof Signal) void options.enabled.value;
      if (options.maxRenderCells instanceof Signal) void options.maxRenderCells.value;
      if (options.frameInterval instanceof Signal) void options.frameInterval.value;
      if (options.idleFrameInterval instanceof Signal) void options.idleFrameInterval.value;
      if (options.interactive instanceof Signal) void options.interactive.value;
      if (options.idleMaxRenderCells instanceof Signal) void options.idleMaxRenderCells.value;
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
      hasGraphicsHandle: this.graphics.hasHandle,
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
      this.activeDeferredReadbackSlots !== ascii.deferredReadbackSlots ||
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
      this.activeDeferredReadbackSlots = ascii.deferredReadbackSlots;
      this.interaction.captureBaseTransform(bundle);
      this.failed = false;
      const rendererFactory = this.options.rendererFactory ??
        ((rendererOptions) => new ThreeAsciiRenderer(rendererOptions));
      const effectOptions = asciiEffectOptions(ascii);
      const renderSize = this.renderSizeFor(rect, ascii);
      this.renderer = rendererFactory({
        scene: bundle.scene,
        camera: bundle.camera,
        ...renderSize,
        effect: effectOptions,
        terminalEdgeBias: ascii.terminalEdgeBias,
        terminalGlyphStyle: ascii.terminalGlyphStyle,
        deferredReadbackSlots: ascii.deferredReadbackSlots,
        readbackStrategy: this.options.readbackStrategy ?? "deferred",
      });
      this.captureAppliedRendererState(rect, ascii, effectOptions, renderSize);
      this.setGrid(
        buildFallbackGrid(renderSize.columns, renderSize.rows, "INITIALIZING", "ASCII RENDERER STARTING"),
      );
    }

    if (this.rendering) {
      const renderSize = this.renderSizeFor(rect, ascii);
      const effectOptions = asciiEffectOptions(ascii);
      if (
        threePanelRendererStateMatches(
          {
            columns: this.appliedColumns,
            rows: this.appliedRows,
            effectOptions: this.appliedEffectOptions,
            terminalEdgeBias: this.appliedTerminalEdgeBias,
            terminalGlyphStyle: this.appliedTerminalGlyphStyle,
          },
          {
            columns: renderSize.columns,
            rows: renderSize.rows,
            effectOptions,
            terminalEdgeBias: ascii.terminalEdgeBias,
            terminalGlyphStyle: ascii.terminalGlyphStyle,
          },
        )
      ) {
        return;
      }
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
      const frame = await this.renderQueue.run(async () => {
        if (!this.isCurrentFrame(frameGeneration, renderer, bundle)) return {};
        return renderer.renderFrame
          ? await renderer.renderFrame(deltaTime, onFrame, policy.frameOptions)
          : { grid: await renderer.renderToAnsiGrid(deltaTime, onFrame) };
      });

      if (!this.isCurrentFrame(frameGeneration, renderer, bundle)) {
        return;
      }

      if (policy.renderImage && frame.image && graphicsSurface) {
        await this.graphics.put(graphicsSurface, frame.image, graphicsRectangle, frameGeneration);
      } else {
        await this.clearGraphicsImage();
      }

      if (!this.isCurrentFrame(frameGeneration, renderer, bundle)) {
        return;
      }

      this.failed = false;
      const renderSize = this.renderSizeFor(rect, ascii);
      const nextGrid = policy.renderAscii ? frame.grid ?? [] : this.blankGridFor(renderSize.columns, renderSize.rows);
      if (!policy.renderAscii || this.hasGridCells(nextGrid)) {
        this.setGrid(
          nextGrid,
          policy.renderAscii,
          policy.renderAscii ? frame.gridRevision : undefined,
        );
      }
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
          nextFrameDelay(this.currentFrameInterval(), frameStartedAt, performance.now()),
        );
      }
    }
  }

  private reportSlowFrame(renderer: ThreePanelGridRenderer): void {
    const performanceInfo = renderer.inspectPerformance?.();
    if (!performanceInfo) return;
    const now = performance.now();
    const targetMs = Math.max(1, this.currentFrameInterval());
    const slowThreshold = Math.max(80, targetMs * 1.5);
    if (performanceInfo.totalMs < slowThreshold || now - this.lastSlowFrameReportTime < 2_000) return;
    this.lastSlowFrameReportTime = now;
    this.options.diagnostics?.report(threePanelSlowFrameDiagnostic(performanceInfo));
  }

  private updateAdaptiveRenderBudget(
    renderer: ThreePanelGridRenderer,
    ascii: Pick<AsciiOptions, "renderMaxCells">,
  ): void {
    const performanceInfo = renderer.inspectPerformance?.();
    if (!performanceInfo) return;
    const requestedMaxCells = this.requestedRenderMaxCells(ascii);
    const targetMs = this.currentFrameInterval();
    const next = this.adaptiveBudget.update({
      requestedMaxCells,
      frameMs: performanceInfo.totalMs,
      targetMs,
    });
    if (!next.changed) return;

    this.invalidateFrame();
    this.running = false;
    this.syncPending = true;
    if (next.direction === "steady") return;

    const maxCells = next.maxCells ?? requestedMaxCells;
    this.options.diagnostics?.report(
      threePanelAdaptiveRenderCellsDiagnostic({
        direction: next.direction,
        maxCells,
        requestedMaxCells,
        frameMs: performanceInfo.totalMs,
        targetMs,
      }),
    );
  }

  private scheduleSync(): void {
    if (this.disposed) return;
    this.syncScheduler.schedule(this.syncCallback);
  }

  private setGrid(grid: string[][], forceUpdate = false, revision?: number): void {
    if (this.disposed) return;
    if (revision !== undefined) {
      if (this.gridRevision === revision && this.grid.peek() === grid) return;
      this.gridRevision = revision;
      this.gridFingerprint = "";
      this.grid.jink(grid);
      this.onUpdate?.();
      return;
    }
    this.gridRevision = undefined;
    if (!forceUpdate && this.grid.peek() === grid) return;
    const fingerprint = fingerprintThreePanelGrid(grid);
    if (this.gridFingerprint === fingerprint) return;
    this.gridFingerprint = fingerprint;
    this.grid.jink(grid);
    this.onUpdate?.();
  }

  private blankGridFor(columns: number, rows: number): string[][] {
    if (this.blankGridColumns === columns && this.blankGridRows === rows) return this.blankGridCache;
    this.blankGridColumns = columns;
    this.blankGridRows = rows;
    this.blankGridCache = threePanelBlankGrid(columns, rows);
    return this.blankGridCache;
  }

  private hasGridCells(grid: readonly (readonly string[] | undefined)[]): boolean {
    return grid.length > 0 && (grid[0]?.length ?? 0) > 0;
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
    this.activeDeferredReadbackSlots = undefined;
    this.interaction.clearBaseTransform();
    this.adaptiveBudget.reset();
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
    renderSize = this.renderSizeFor(rect, ascii),
  ): void {
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
    if (!threePanelAsciiEffectOptionsEqual(this.appliedEffectOptions, effectOptions)) {
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
    return this.adaptiveBudget.renderSize(rect, this.requestedRenderMaxCells(ascii));
  }

  private requestedRenderMaxCells(ascii: Pick<AsciiOptions, "renderMaxCells">): number {
    const maxRenderCells = !this.isInteractive() && this.options.idleMaxRenderCells !== undefined
      ? resolveThreePanelRenderCellsValue(this.options.idleMaxRenderCells)
      : resolveThreePanelRenderCellsValue(this.options.maxRenderCells);
    return resolveThreePanelRequestedMaxCells({
      userMaxCells: ascii.renderMaxCells,
      pressureMaxCells: maxRenderCells,
    });
  }

  private currentFrameInterval(): number {
    const frameInterval = !this.isInteractive() && this.idleFrameInterval !== undefined
      ? this.idleFrameInterval
      : this.frameInterval;
    return resolveThreePanelFrameInterval(resolveThreePanelIntervalValue(frameInterval));
  }

  private isInteractive(): boolean {
    return resolveThreePanelLiveValue(this.interactive);
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

    const rendererSupportsImage = typeof renderer.renderFrame === "function";
    const reason = threePanelGraphicsFallbackReason({ inspection, rect, rendererSupportsImage });
    const key = `${reason}|${inspection?.reason ?? ""}|${ascii.kittyDisableAscii ? "kitty-only" : "dual"}`;
    if (key === this.lastGraphicsUnavailableKey) return;
    this.lastGraphicsUnavailableKey = key;

    this.options.diagnostics?.report(
      threePanelGraphicsFallbackDiagnostic({
        inspection,
        rect,
        rendererSupportsImage,
        kittyDisableAscii: ascii.kittyDisableAscii,
      }),
    );
  }

  private async clearGraphicsImage(): Promise<void> {
    await this.graphics.clear(this.resolveGraphicsSurface());
  }
}

function resolveThreePanelIntervalValue(value: ThreePanelIntervalValue): number {
  return value instanceof Signal ? value.peek() : value;
}

function resolveThreePanelRenderCellsValue(value: ThreePanelRenderCellsValue | undefined): number | undefined {
  return value instanceof Signal ? value.peek() : value;
}

function resolveThreePanelLiveValue(value: ThreePanelLiveValue | undefined): boolean {
  if (value === undefined) return true;
  if (value instanceof Signal) return value.peek();
  if (typeof value === "function") return value();
  return value;
}
