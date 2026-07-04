import { Camera, type Color, PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { RenderPipeline, WebGPURenderer } from "npm:three@0.183.2/webgpu";
import { pass } from "npm:three@0.183.2/tsl";

import { AcerolaAsciiNode, type AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import {
  buildThreeAsciiAnsiGrid as buildThreeAsciiAnsiGridInternal,
  ThreeAsciiAnsiGridAssembler as InternalThreeAsciiAnsiGridAssembler,
  type ThreeAsciiAnsiGridInput as InternalThreeAsciiAnsiGridInput,
} from "./ansi_grid.ts";
import { computeThreeAsciiCameraAspect, shouldUpdateThreeAsciiCameraAspect } from "./camera_aspect.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import { HeadlessCanvas } from "./headless_canvas.ts";
import { loadAsciiLutTextures } from "./loadAsciiLuts.ts";
import {
  type ThreeAsciiDeferredReadbackConsumeResult,
  type ThreeAsciiDeferredReadbackFrame,
  ThreeAsciiDeferredReadbackQueue,
} from "./deferred_readback.ts";
import { resolveThreeAsciiDeferredReadbackStaleness } from "./deferred_readback_staleness.ts";
import { createThreeAsciiComputeBindGroups } from "./compute_bind_groups.ts";
import { encodeThreeAsciiComputeDispatchCommands } from "./compute_commands.ts";
import { createThreeAsciiComputeDispatchPlan } from "./compute_plan.ts";
import { createThreeAsciiComputePipeline } from "./compute_pipeline.ts";
import { applyThreeAsciiComputeResourcePlanState, createThreeAsciiComputeResourcePlan } from "./compute_resources.ts";
import {
  shouldIncludeThreeAsciiTerminalEdges,
  type ThreeAsciiEffectState,
  threeAsciiEffectStateFromSource,
} from "./effect_state.ts";
import { patchThreeAsciiEffectOptions } from "./effect_options.ts";
import {
  destroyThreeAsciiGpuBufferSlot,
  ensureThreeAsciiGpuBufferSlot,
  type ThreeAsciiGpuBufferSlot,
} from "./gpu_buffers.ts";
import {
  createThreeAsciiRendererPerformance,
  createThreeAsciiRendererSaturatedPerformance,
  type ThreeAsciiRendererPerformance,
} from "./performance.ts";
import {
  executeThreeAsciiReadbackCopyPlan,
  ThreeAsciiReadbackCopyPlanCache,
  type ThreeAsciiReadbackLayout,
  ThreeAsciiReadbackLayoutCache,
  ThreeAsciiReadbackViewCache,
} from "./readback.ts";
import {
  assembleThreeAsciiReadbackGridWithContext,
  type ThreeAsciiReadbackGridAssemblyContext,
} from "./readback_assembly.ts";
import { handleThreeAsciiDeferredReadbackFailure } from "./readback_failure.ts";
import { withThreeAsciiMappedReadback } from "./readback_mapping.ts";
import { resolveThreeAsciiDeferredReadbackSubmission } from "./readback_submission.ts";
import {
  emptyThreeAsciiRenderFrame,
  resolveThreeAsciiRenderFrameSelection,
  type ThreeAsciiRenderFrameOptions,
} from "./frame_options.ts";
import { readThreeAsciiImageFrame, type ThreeAsciiImageFrame } from "./image_frame.ts";
import {
  normalizeThreeAsciiRendererOptions,
  normalizeThreeAsciiRenderSize,
  normalizeThreeAsciiTerminalEdgeBias,
  type ThreeAsciiReadbackStrategy,
} from "./renderer_options.ts";
import {
  THREE_ASCII_COLOR_SHADER,
  THREE_ASCII_EDGE_SHADER,
  THREE_ASCII_FILL_SHADER,
  THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE,
  THREE_ASCII_TILE_SIZE,
  THREE_ASCII_WORKGROUP_SIZE,
} from "./shaders.ts";
import { THREE_ASCII_UNIFORM_FLOAT_COUNT, writeThreeAsciiUniformValues } from "./uniforms.ts";
import { getCompatibleWebGPUDevice } from "./webgpu_compat.ts";

const GPU_MAP_READ = 1;

type ThreeBackendRenderer = WebGPURenderer & {
  backend: {
    device: GPUDevice;
    get(object: unknown): { texture?: GPUTexture };
  };
};

/** Options for configuring three Ascii Renderer. */
export interface ThreeAsciiRendererOptions {
  scene: Scene;
  camera: Camera;
  columns: number;
  rows: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
  readbackStrategy?: "blocking" | "deferred";
  deferredReadbackSlots?: number;
  deferredReadbackMaxStaleFrames?: number;
  effect?: AcerolaAsciiNodeOptions;
}

/** Combined render output from one three Ascii renderer pass. */
export interface ThreeAsciiRenderFrame {
  grid?: string[][];
  gridRevision?: number;
  image?: ThreeAsciiImageFrame;
}

export type { ThreeAsciiRenderFrameOptions } from "./frame_options.ts";
export type { ThreeAsciiImageFrame } from "./image_frame.ts";
export type { ThreeAsciiRendererPerformance } from "./performance.ts";

/** Stable error raised when WebGPU output buffers cannot be mapped back to CPU-readable memory. */
export class ThreeAsciiReadbackError extends Error {
  readonly code = "three-ascii-readback-unavailable";
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Three ASCII GPU readback unavailable.");
    this.name = "ThreeAsciiReadbackError";
    this.cause = cause;
  }
}

/** Input buffers for assembling a terminal ANSI grid from three Ascii GPU readback data. */
export interface ThreeAsciiAnsiGridInput extends InternalThreeAsciiAnsiGridInput {}

/** Reusable ANSI grid assembler that keeps color and cell string caches warm across frames. */
export class ThreeAsciiAnsiGridAssembler extends InternalThreeAsciiAnsiGridAssembler {}

/** Builds the terminal ANSI cell grid for a three Ascii frame. */
export function buildThreeAsciiAnsiGrid(input: ThreeAsciiAnsiGridInput): string[][] {
  return buildThreeAsciiAnsiGridInternal(input);
}

/** Public class implementing a three Ascii Renderer. */
export class ThreeAsciiRenderer {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly pixelAspectRatio: number;

  columns: number;
  rows: number;

  private readonly effectOptions: AcerolaAsciiNodeOptions;
  private readonly canvas: HeadlessCanvas;
  private terminalEdgeBias: number;
  private terminalGlyphStyle: TerminalGlyphStyle;
  private readbackStrategy: ThreeAsciiReadbackStrategy;

  private initPromise?: Promise<void>;
  private renderer?: ThreeBackendRenderer;
  private renderPipeline?: RenderPipeline;
  private asciiNode?: AcerolaAsciiNode;

  private device?: GPUDevice;
  private paramsBuffer?: GPUBuffer;
  private fillPipeline?: GPUComputePipeline;
  private edgePipeline?: GPUComputePipeline;
  private colorPipeline?: GPUComputePipeline;
  private fillBindGroup?: GPUBindGroup;
  private edgeBindGroup?: GPUBindGroup;
  private colorBindGroup?: GPUBindGroup;
  private fillOutput?: ThreeAsciiGpuBufferSlot<GPUBuffer>;
  private edgeOutput?: ThreeAsciiGpuBufferSlot<GPUBuffer>;
  private colorOutput?: ThreeAsciiGpuBufferSlot<GPUBuffer>;
  private outputReadback?: ThreeAsciiGpuBufferSlot<GPUBuffer>;
  private readonly deferredReadbacks: ThreeAsciiDeferredReadbackQueue<GPUBuffer>;
  private uniformValues = new Float32Array(THREE_ASCII_UNIFORM_FLOAT_COUNT);
  private readonly ansiGridAssembler = new ThreeAsciiAnsiGridAssembler({ reuseGrid: true });
  private readonly readbackLayoutCache = new ThreeAsciiReadbackLayoutCache();
  private readonly readbackCopyPlanCache = new ThreeAsciiReadbackCopyPlanCache();
  private readonly readbackViewCache = new ThreeAsciiReadbackViewCache();
  private readonly readbackAssemblyContext: ThreeAsciiReadbackGridAssemblyContext = {
    viewCache: this.readbackViewCache,
    assembler: this.ansiGridAssembler,
  };
  private outputCellCount = 0;
  private sizeDirty = true;
  private computeDirty = true;
  private uniformDirty = true;
  private lastPerformance?: ThreeAsciiRendererPerformance;
  private lastReadbackMs = 0;
  private lastAssemblyMs = 0;
  private gridRevision = 0;
  private readonly deferredReadbackMaxStaleFrames: number;
  private deferredReadbackStaleFrames = 0;

  constructor(options: ThreeAsciiRendererOptions) {
    const normalized = normalizeThreeAsciiRendererOptions(options);
    this.scene = options.scene;
    this.camera = options.camera;
    this.columns = normalized.columns;
    this.rows = normalized.rows;
    this.pixelAspectRatio = normalized.pixelAspectRatio;
    this.effectOptions = { ...options.effect };
    this.terminalEdgeBias = normalized.terminalEdgeBias;
    this.terminalGlyphStyle = normalized.terminalGlyphStyle;
    this.readbackStrategy = normalized.readbackStrategy;
    this.deferredReadbackMaxStaleFrames = normalized.deferredReadbackMaxStaleFrames;
    this.deferredReadbacks = new ThreeAsciiDeferredReadbackQueue<GPUBuffer>({
      mapModeRead: GPU_MAP_READ,
      slotCount: normalized.deferredReadbackSlots,
    });
    this.canvas = new HeadlessCanvas(1, 1);
  }

  async init(): Promise<void> {
    this.initPromise ??= this.initInternal();
    await this.initPromise;
  }

  setSize(columns: number, rows: number): void {
    const next = normalizeThreeAsciiRenderSize(columns, rows);

    if (this.columns === next.columns && this.rows === next.rows) {
      return;
    }

    this.columns = next.columns;
    this.rows = next.rows;
    this.sizeDirty = true;
    this.computeDirty = true;
    this.uniformDirty = true;
    this.deferredReadbacks.invalidate();
  }

  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void {
    const result = patchThreeAsciiEffectOptions(this.effectOptions, options);
    if (!result.changed) return;
    this.asciiNode?.applyOptions(result.patch);
    if (result.uniformDirty) this.uniformDirty = true;
  }

  getTerminalEdgeBias(): number {
    return this.terminalEdgeBias;
  }

  setTerminalEdgeBias(value: number): void {
    const next = normalizeThreeAsciiTerminalEdgeBias(value);
    if (this.terminalEdgeBias === next) return;
    this.terminalEdgeBias = next;
    this.uniformDirty = true;
  }

  getTerminalGlyphStyle(): TerminalGlyphStyle {
    return this.terminalGlyphStyle;
  }

  inspectPerformance(): ThreeAsciiRendererPerformance | undefined {
    return this.lastPerformance ? { ...this.lastPerformance } : undefined;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    if (this.terminalGlyphStyle === value) return;
    this.terminalGlyphStyle = value;
    this.computeDirty = true;
  }

  async renderToAnsiGrid(
    deltaTime = 0,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    const frame = await this.renderFrame(deltaTime, onFrame, { ansi: true });
    return frame.grid ?? [];
  }

  async renderToImageFrame(
    deltaTime = 0,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<ThreeAsciiImageFrame> {
    const frame = await this.renderFrame(deltaTime, onFrame, { ansi: false, image: true });
    if (!frame.image) {
      throw new Error("ThreeAsciiRenderer did not produce an image frame.");
    }
    return frame.image;
  }

  async renderFrame(
    deltaTime = 0,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options: ThreeAsciiRenderFrameOptions = { ansi: true },
  ): Promise<ThreeAsciiRenderFrame> {
    const frameStart = performance.now();
    const { renderAnsi, renderImage } = resolveThreeAsciiRenderFrameSelection(options);

    if (this.columns <= 0 || this.rows <= 0) {
      return emptyThreeAsciiRenderFrame({ renderAnsi, renderImage });
    }

    let deferredAnsiGrid: ThreeAsciiDeferredReadbackConsumeResult | undefined;
    let forceBlockingDeferredReadback = false;
    if (renderAnsi && !renderImage && this.readbackStrategy === "deferred") {
      deferredAnsiGrid = this.consumeDeferredAnsiGrid();
      if (deferredAnsiGrid.readbackUnavailable) {
        const frameEnd = performance.now();
        this.lastPerformance = createThreeAsciiRendererPerformance({
          columns: this.columns,
          rows: this.rows,
          terminalGlyphStyle: this.terminalGlyphStyle,
          frameMs: frameEnd - frameStart,
          sceneMs: 0,
          ansiMs: 0,
          readbackMs: 0,
          assemblyMs: 0,
        });
        return { grid: deferredAnsiGrid.grid ?? [], gridRevision: this.gridRevision };
      }
      forceBlockingDeferredReadback = this.updateDeferredReadbackStaleness(deferredAnsiGrid);
      if (!deferredAnsiGrid.grid && this.deferredReadbacks.isSaturated()) {
        const frameEnd = performance.now();
        const previous = this.lastPerformance;
        const queue = this.deferredReadbacks.inspect();
        this.lastPerformance = createThreeAsciiRendererSaturatedPerformance({
          columns: this.columns,
          rows: this.rows,
          terminalGlyphStyle: this.terminalGlyphStyle,
          frameMs: frameEnd - frameStart,
          previousFrameMs: previous?.totalMs,
          readbackMs: this.lastReadbackMs,
          queue,
        });
        return { grid: this.deferredReadbacks.lastCompletedGrid(), gridRevision: this.gridRevision };
      }
    }

    await this.renderScene(deltaTime, onFrame);
    const sceneEnd = performance.now();

    const frame: ThreeAsciiRenderFrame = {};
    if (renderImage) {
      frame.image = await readThreeAsciiImageFrame(this.canvas);
    }

    if (renderAnsi) {
      frame.grid = await this.computeAnsiGrid(deferredAnsiGrid, forceBlockingDeferredReadback);
      frame.gridRevision = this.gridRevision;
    }
    const frameEnd = performance.now();
    const queue = this.readbackStrategy === "deferred" ? this.deferredReadbacks.inspect() : undefined;
    this.lastPerformance = createThreeAsciiRendererPerformance({
      columns: this.columns,
      rows: this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      frameMs: frameEnd - frameStart,
      sceneMs: sceneEnd - frameStart,
      ansiMs: renderAnsi ? frameEnd - sceneEnd : 0,
      readbackMs: renderAnsi ? this.lastReadbackMs : 0,
      assemblyMs: renderAnsi ? this.lastAssemblyMs : 0,
      queue,
    });

    return frame;
  }

  private async renderScene(
    deltaTime: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<void> {
    await this.init();
    if (onFrame) {
      await onFrame(deltaTime);
    }
    this.applySize();
    this.updateCameraAspect();
    this.renderPipeline!.render();
  }

  private async computeAnsiGrid(
    deferredCompleted?: ThreeAsciiDeferredReadbackConsumeResult,
    forceBlockingDeferredReadback = false,
  ): Promise<string[][]> {
    const effectState = this.getEffectState();
    const includeTerminalEdges = shouldIncludeThreeAsciiTerminalEdges(effectState, this.terminalGlyphStyle);
    await this.ensureComputeResources(effectState, includeTerminalEdges);
    this.writeUniforms(effectState);

    const commandEncoder = this.device!.createCommandEncoder({
      label: "deno_tui.three_ascii.cells",
    });
    const dispatchPlan = createThreeAsciiComputeDispatchPlan({
      columns: this.columns,
      rows: this.rows,
      workgroupSize: THREE_ASCII_WORKGROUP_SIZE,
      includeEdges: includeTerminalEdges,
    });
    encodeThreeAsciiComputeDispatchCommands(commandEncoder, dispatchPlan, {
      pipelineForPass: (kind) => this.computePipelineForPass(kind),
      bindGroupForPass: (kind) => this.computeBindGroupForPass(kind),
    });

    const readbackLayout = this.readbackLayoutCache.resolve({
      fillByteLength: this.fillOutput!.byteLength,
      edgeByteLength: this.edgeOutput?.byteLength ?? 0,
      colorByteLength: this.colorOutput!.byteLength,
      includeEdges: includeTerminalEdges,
    });
    const readbackCopyPlan = this.readbackCopyPlanCache.resolve({
      fill: { label: "fill", byteLength: this.fillOutput!.byteLength },
      edge: this.edgeOutput ? { label: "edge", byteLength: this.edgeOutput.byteLength } : undefined,
      color: { label: "color", byteLength: this.colorOutput!.byteLength },
      includeEdges: includeTerminalEdges,
      layout: readbackLayout,
    });

    if (this.readbackStrategy === "deferred" && !forceBlockingDeferredReadback) {
      return this.deferAnsiGridReadback(
        commandEncoder,
        readbackLayout,
        readbackCopyPlan,
        effectState.backgroundColor,
        deferredCompleted,
      );
    }

    this.outputReadback = this.ensureReadbackBuffer(this.outputReadback, readbackLayout.byteLength);
    this.copyReadbackCommands(commandEncoder, readbackCopyPlan, this.outputReadback);
    this.device!.queue.submit([commandEncoder.finish()]);

    const grid = await this.buildAnsiGridFromReadback(readbackLayout, effectState.backgroundColor);
    if (forceBlockingDeferredReadback) {
      this.deferredReadbackStaleFrames = 0;
      this.deferredReadbacks.replaceLastCompletedGrid(grid);
    }
    return grid;
  }

  private async deferAnsiGridReadback(
    commandEncoder: GPUCommandEncoder,
    readbackLayout: ThreeAsciiReadbackLayout,
    readbackCopyPlan: ReturnType<ThreeAsciiReadbackCopyPlanCache["resolve"]>,
    backgroundColor: Color,
    deferredCompleted?: ThreeAsciiDeferredReadbackConsumeResult,
  ): Promise<string[][]> {
    const completed = deferredCompleted ?? this.consumeDeferredAnsiGrid();
    if (this.readbackStrategy !== "deferred") {
      if (completed.readbackUnavailable) {
        return completed.grid ?? [];
      }
      this.outputReadback = this.ensureReadbackBuffer(this.outputReadback, readbackLayout.byteLength);
      this.copyReadbackCommands(commandEncoder, readbackCopyPlan, this.outputReadback);
      this.device!.queue.submit([commandEncoder.finish()]);
      return await this.buildAnsiGridFromReadback(readbackLayout, backgroundColor);
    }

    const awaitBootstrap = this.shouldBootstrapDeferredAnsiReadback(completed);

    const readback = this.deferredReadbacks.nextBuffer(
      readbackLayout.byteLength,
      (current, byteLength) => this.ensureReadbackBuffer(current, byteLength),
    );
    const submission = resolveThreeAsciiDeferredReadbackSubmission(
      completed,
      readback,
      this.deferredReadbacks.lastCompletedGrid(),
    );
    if (!submission.submit || !submission.readback) return submission.grid;

    this.copyReadbackCommands(commandEncoder, readbackCopyPlan, submission.readback);
    this.device!.queue.submit([commandEncoder.finish()]);
    const pending = this.deferredReadbacks.queue(submission.readback, {
      layout: readbackLayout,
      columns: this.columns,
      rows: this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      terminalEdgeBias: this.terminalEdgeBias,
      backgroundColor: backgroundColor.clone(),
    });
    if (awaitBootstrap) {
      await pending.mapPromise;
      const bootstrapped = this.consumeDeferredAnsiGrid();
      if (bootstrapped.readbackUnavailable) return bootstrapped.grid ?? [];
      return bootstrapped.grid ?? this.deferredReadbacks.lastCompletedGrid();
    }
    return submission.grid;
  }

  private shouldBootstrapDeferredAnsiReadback(completed: ThreeAsciiDeferredReadbackConsumeResult): boolean {
    if (completed.readbackUnavailable || completed.grid) return false;
    if (this.deferredReadbacks.lastCompletedGrid().length > 0) return false;
    return this.deferredReadbacks.inspect().pending === 0;
  }

  private updateDeferredReadbackStaleness(completed: ThreeAsciiDeferredReadbackConsumeResult): boolean {
    const next = resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: this.deferredReadbackStaleFrames,
      maxStaleFrames: this.deferredReadbackMaxStaleFrames,
      completedGrid: Boolean(completed.grid),
      hasCachedGrid: this.deferredReadbacks.lastCompletedGrid().length > 0,
    });
    this.deferredReadbackStaleFrames = next.staleFrames;
    return next.forceBlockingReadback;
  }

  private consumeDeferredAnsiGrid(): ThreeAsciiDeferredReadbackConsumeResult {
    let completed: ThreeAsciiDeferredReadbackConsumeResult;
    try {
      completed = this.deferredReadbacks.consumeCompleted(
        (pending) => this.buildAnsiGridFromMappedReadback(pending),
        (error) => new ThreeAsciiReadbackError(error),
      );
    } catch (error) {
      const failure = handleThreeAsciiDeferredReadbackFailure(error, ThreeAsciiReadbackError, this.deferredReadbacks);
      if (failure.handled) {
        this.lastReadbackMs = 0;
        return failure.result!;
      }
      throw error;
    }
    if (completed.readbackMs !== undefined) {
      this.lastReadbackMs = completed.readbackMs;
    }
    return completed;
  }

  private copyReadbackCommands(
    commandEncoder: GPUCommandEncoder,
    readbackCopyPlan: ReturnType<ThreeAsciiReadbackCopyPlanCache["resolve"]>,
    readback: ThreeAsciiGpuBufferSlot<GPUBuffer> | undefined,
  ): void {
    executeThreeAsciiReadbackCopyPlan(
      commandEncoder,
      readbackCopyPlan,
      {
        fill: this.fillOutput!.gpu,
        edge: this.edgeOutput?.gpu,
        color: this.colorOutput!.gpu,
      },
      readback,
    );
  }

  private computePipelineForPass(kind: "fill" | "edge" | "color"): GPUComputePipeline {
    switch (kind) {
      case "fill":
        return this.fillPipeline!;
      case "edge":
        return this.edgePipeline!;
      case "color":
        return this.colorPipeline!;
    }
  }

  private computeBindGroupForPass(kind: "fill" | "edge" | "color"): GPUBindGroup {
    switch (kind) {
      case "fill":
        return this.fillBindGroup!;
      case "edge":
        return this.edgeBindGroup!;
      case "color":
        return this.colorBindGroup!;
    }
  }

  destroy(): void {
    this.fillOutput = destroyThreeAsciiGpuBufferSlot(this.fillOutput);
    this.edgeOutput = destroyThreeAsciiGpuBufferSlot(this.edgeOutput);
    this.colorOutput = destroyThreeAsciiGpuBufferSlot(this.colorOutput);
    this.outputReadback = destroyThreeAsciiGpuBufferSlot(this.outputReadback);
    this.deferredReadbacks.destroy();
    this.paramsBuffer?.destroy();
    this.paramsBuffer = undefined;
    this.readbackLayoutCache.clear();
    this.readbackCopyPlanCache.clear();
    this.readbackViewCache.clear();

    this.renderPipeline?.dispose();
    this.renderPipeline = undefined;

    this.asciiNode?.dispose();
    this.asciiNode = undefined;
    this.ansiGridAssembler.clear();

    this.renderer?.setAnimationLoop?.(null);
    this.renderer?.dispose();
    this.renderer = undefined;
    this.device = undefined;
  }

  private async initInternal(): Promise<void> {
    const lutsPromise = loadAsciiLutTextures(
      new URL("./assets/edgesASCII.png", import.meta.url),
      new URL("./assets/fillASCII.png", import.meta.url),
    );
    const device = await getCompatibleWebGPUDevice();
    const renderer = new WebGPURenderer({
      alpha: false,
      antialias: false,
      canvas: this.canvas as any,
      context: this.canvas.getContext("webgpu") as any,
      device,
    }) as ThreeBackendRenderer;

    renderer.setPixelRatio(1);
    renderer.setSize(THREE_ASCII_TILE_SIZE, THREE_ASCII_TILE_SIZE);
    await renderer.init();

    const scenePass = pass(this.scene, this.camera);
    const luts = await lutsPromise;

    const asciiNode = new AcerolaAsciiNode(
      scenePass.getTextureNode(),
      scenePass.getTextureNode("depth"),
      this.camera,
      luts,
      this.effectOptions,
    );

    this.device = device;
    this.renderer = renderer;
    this.asciiNode = asciiNode;
    this.renderPipeline = new RenderPipeline(renderer, asciiNode);

    this.applySize();
  }

  private applySize(): void {
    if (!this.renderer || !this.sizeDirty) {
      return;
    }

    this.renderer.setSize(this.columns * THREE_ASCII_TILE_SIZE, this.rows * THREE_ASCII_TILE_SIZE);
    this.sizeDirty = false;
    this.computeDirty = true;
  }

  private updateCameraAspect(): void {
    if (!(this.camera instanceof PerspectiveCamera)) {
      return;
    }

    const aspect = computeThreeAsciiCameraAspect({
      columns: this.columns,
      rows: this.rows,
      pixelAspectRatio: this.pixelAspectRatio,
    });

    if (shouldUpdateThreeAsciiCameraAspect(this.camera.aspect, aspect)) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  private async ensureComputeResources(
    effectState: ThreeAsciiEffectState,
    includeTerminalEdges = effectState.edges,
  ): Promise<void> {
    if (!this.device || !this.renderer || !this.asciiNode) {
      throw new Error("ThreeAsciiRenderer has not been initialized.");
    }

    if (!this.fillPipeline) {
      this.fillPipeline = createThreeAsciiComputePipeline({
        device: this.device,
        label: "deno_tui.three_ascii.fill",
        code: THREE_ASCII_FILL_SHADER,
      });
      this.colorPipeline = createThreeAsciiComputePipeline({
        device: this.device,
        label: "deno_tui.three_ascii.color",
        code: THREE_ASCII_COLOR_SHADER,
      });
    }

    if (includeTerminalEdges && !this.edgePipeline) {
      this.edgePipeline = createThreeAsciiComputePipeline({
        device: this.device,
        label: "deno_tui.three_ascii.edge",
        code: THREE_ASCII_EDGE_SHADER,
      });
    }

    if (!this.paramsBuffer) {
      this.paramsBuffer = this.device.createBuffer({
        label: "deno_tui.three_ascii.params",
        size: this.uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.uniformDirty = true;
    }

    const resourcePlan = createThreeAsciiComputeResourcePlan({
      columns: this.columns,
      rows: this.rows,
      includeEdges: includeTerminalEdges,
      currentCellCount: this.outputCellCount,
      hasEdgeOutput: this.edgeOutput !== undefined,
      hasEdgeBindGroup: this.edgeBindGroup !== undefined,
    });
    if (resourcePlan.resizeOutputs) {
      this.fillOutput = this.ensureStorageBufferSlot(
        this.fillOutput,
        resourcePlan.fillByteLength,
        "fill",
      );
      this.colorOutput = this.ensureStorageBufferSlot(
        this.colorOutput,
        resourcePlan.colorByteLength,
        "color",
      );
    }

    if (resourcePlan.ensureEdgeOutput) {
      this.edgeOutput = this.ensureStorageBufferSlot(
        this.edgeOutput,
        resourcePlan.edgeByteLength,
        "edge",
      );
    } else if (resourcePlan.releaseEdgeOutput) {
      this.edgeOutput = destroyThreeAsciiGpuBufferSlot(this.edgeOutput);
    }

    const resourceState = applyThreeAsciiComputeResourcePlanState({
      currentCellCount: this.outputCellCount,
      computeDirty: this.computeDirty,
    }, resourcePlan);
    this.outputCellCount = resourceState.outputCellCount;
    this.computeDirty = resourceState.computeDirty;
    if (resourceState.clearEdgeBindGroup) {
      this.edgeBindGroup = undefined;
    }

    if (!this.computeDirty) {
      return;
    }

    const bindGroups = createThreeAsciiComputeBindGroups({
      device: this.device,
      paramsBuffer: this.paramsBuffer,
      fillPipeline: this.fillPipeline!,
      edgePipeline: this.edgePipeline,
      colorPipeline: this.colorPipeline!,
      fillOutput: this.fillOutput!.gpu,
      edgeOutput: this.edgeOutput?.gpu,
      colorOutput: this.colorOutput!.gpu,
      downscaleTexture: this.getGpuTexture(this.asciiNode.downscaleTarget.texture),
      sobelTexture: includeTerminalEdges ? this.getGpuTexture(this.asciiNode.sobelTarget.texture) : undefined,
      normalsTexture: this.getGpuTexture(this.asciiNode.normalsTarget.texture),
      includeEdges: includeTerminalEdges,
    });
    this.fillBindGroup = bindGroups.fillBindGroup;
    this.edgeBindGroup = bindGroups.edgeBindGroup;
    this.colorBindGroup = bindGroups.colorBindGroup;

    this.computeDirty = false;
  }

  private getEffectState(): ThreeAsciiEffectState {
    return threeAsciiEffectStateFromSource(this.asciiNode, this.effectOptions);
  }

  private writeUniforms(effectState: ThreeAsciiEffectState): void {
    if (!this.uniformDirty) {
      return;
    }

    writeThreeAsciiUniformValues(this.uniformValues, {
      columns: this.columns,
      rows: this.rows,
      tileSize: THREE_ASCII_TILE_SIZE,
      terminalEdgeBias: this.terminalEdgeBias,
      terminalEdgeThresholdScale: THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE,
      effectState,
    });

    this.device!.queue.writeBuffer(this.paramsBuffer!, 0, this.uniformValues);
    this.uniformDirty = false;
  }

  private getGpuTexture(texture: unknown): GPUTexture {
    const textureData = this.renderer!.backend.get(texture);

    if (!textureData.texture) {
      throw new Error("Three.js did not expose a GPU texture for the requested render target.");
    }

    return textureData.texture;
  }

  private ensureStorageBufferSlot(
    current: ThreeAsciiGpuBufferSlot<GPUBuffer> | undefined,
    byteLength: number,
    label: string,
  ): ThreeAsciiGpuBufferSlot<GPUBuffer> {
    return ensureThreeAsciiGpuBufferSlot(this.device!, current, {
      label: `deno_tui.three_ascii.${label}.storage`,
      byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
  }

  private ensureReadbackBuffer(
    current: ThreeAsciiGpuBufferSlot<GPUBuffer> | undefined,
    byteLength: number,
  ): ThreeAsciiGpuBufferSlot<GPUBuffer> {
    return ensureThreeAsciiGpuBufferSlot(this.device!, current, {
      label: "deno_tui.three_ascii.output.readback",
      byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  private buildAnsiGridFromMappedReadback(pending: ThreeAsciiDeferredReadbackFrame<GPUBuffer>): string[][] {
    const assembly = assembleThreeAsciiReadbackGridWithContext(this.readbackAssemblyContext, {
      source: pending.slot.gpu.getMappedRange(),
      layout: pending.layout,
      columns: pending.columns,
      rows: pending.rows,
      terminalGlyphStyle: pending.terminalGlyphStyle,
      terminalEdgeBias: pending.terminalEdgeBias,
      backgroundColor: pending.backgroundColor,
    });
    this.gridRevision += 1;
    this.lastAssemblyMs = assembly.assemblyMs;
    return assembly.grid;
  }

  private async buildAnsiGridFromReadback(
    layout: ThreeAsciiReadbackLayout,
    backgroundColor: Color,
  ): Promise<string[][]> {
    const readback = this.outputReadback;
    if (!readback || !this.fillOutput || !this.colorOutput || (layout.edgeOffset !== undefined && !this.edgeOutput)) {
      throw new Error("ThreeAsciiRenderer readback buffers have not been initialized.");
    }

    const mapped = await withThreeAsciiMappedReadback(readback.gpu, {
      mapModeRead: GPUMapMode.READ,
      mapError: (error) => new ThreeAsciiReadbackError(error),
      read: (source) =>
        assembleThreeAsciiReadbackGridWithContext(this.readbackAssemblyContext, {
          source,
          layout,
          columns: this.columns,
          rows: this.rows,
          terminalGlyphStyle: this.terminalGlyphStyle,
          terminalEdgeBias: this.terminalEdgeBias,
          backgroundColor,
        }),
    });
    this.gridRevision += 1;
    this.lastReadbackMs = mapped.readbackMs;
    this.lastAssemblyMs = mapped.value.assemblyMs;
    return mapped.value.grid;
  }
}
