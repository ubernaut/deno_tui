import { Camera, type Color, PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { RenderPipeline, WebGPURenderer } from "npm:three@0.183.2/webgpu";
import { pass } from "npm:three@0.183.2/tsl";

import { AcerolaAsciiNode, type AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import {
  buildThreeAsciiAnsiGrid as buildThreeAsciiAnsiGridInternal,
  ThreeAsciiAnsiGridAssembler as InternalThreeAsciiAnsiGridAssembler,
  type ThreeAsciiAnsiGridInput as InternalThreeAsciiAnsiGridInput,
} from "./ansi_grid.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import { HeadlessCanvas } from "./headless_canvas.ts";
import { loadAsciiLutTextures } from "./loadAsciiLuts.ts";
import {
  type ThreeAsciiDeferredReadbackConsumeResult,
  type ThreeAsciiDeferredReadbackFrame,
  ThreeAsciiDeferredReadbackQueue,
} from "./deferred_readback.ts";
import { createThreeAsciiComputeDispatchPlan } from "./compute_plan.ts";
import { createThreeAsciiComputeResourcePlan } from "./compute_resources.ts";
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
  ThreeAsciiReadbackCopyPlanCache,
  type ThreeAsciiReadbackLayout,
  ThreeAsciiReadbackLayoutCache,
  ThreeAsciiReadbackViewCache,
} from "./readback.ts";
import { THREE_ASCII_UNIFORM_FLOAT_COUNT, writeThreeAsciiUniformValues } from "./uniforms.ts";
import { getCompatibleWebGPUDevice } from "./webgpu_compat.ts";

const TILE_SIZE = 8;
const WORKGROUP_SIZE = 8;
const FOG_SCALE = 0.005 / Math.sqrt(Math.log(2));
const DEFAULT_PIXEL_ASPECT_RATIO = 0.5;
const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const DEFAULT_DEFERRED_READBACK_SLOTS = 6;
const TERMINAL_EDGE_THRESHOLD_SCALE = 2;
const MIN_VISIBLE_LUMINANCE = 0.015;
const GPU_MAP_READ = 1;

const FILL_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var downscaleTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> glyphs: array<f32>;

@compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;

  if (params.flags.y < 0.5) {
    glyphs[index] = 0.0;
    return;
  }

  let sample = textureLoad(downscaleTex, vec2<i32>(i32(id.x), i32(id.y)), 0);
  let exposure = params.effect0.x;
  let attenuation = params.effect0.y;

  var luminanceValue = clamp(pow(max(sample.a, 0.0) * exposure, attenuation), 0.0, 1.0);
  var fillBucket = i32(0);

  if (luminanceValue > ${MIN_VISIBLE_LUMINANCE}) {
    fillBucket = clamp(i32(floor(luminanceValue * 9.0)) + 1, i32(1), i32(9));
  }

  if (params.flags.z > 0.5) {
    fillBucket = select(i32(0), 10 - fillBucket, fillBucket > 0);
  }

  glyphs[index] = f32(fillBucket + 5);
}
`;

const EDGE_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sobelTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> glyphs: array<vec4<f32>>;

fn classifyDirection(theta: f32, valid: f32) -> i32 {
  if (valid <= 0.5) {
    return -1;
  }

  let absTheta = abs(theta) / ${Math.PI};

  if (absTheta < 0.05 || (absTheta > 0.9 && absTheta <= 1.0)) {
    return 0;
  }

  if (absTheta > 0.45 && absTheta < 0.55) {
    return 1;
  }

  if (absTheta > 0.05 && absTheta < 0.45) {
    return select(2, 3, theta > 0.0);
  }

  if (absTheta > 0.55 && absTheta < 0.9) {
    return select(3, 2, theta > 0.0);
  }

  return -1;
}

@compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;

  if (params.flags.x < 0.5) {
    glyphs[index] = vec4<f32>(0.0);
    return;
  }

  let tileBase = vec2<i32>(i32(id.x) * ${TILE_SIZE}, i32(id.y) * ${TILE_SIZE});

  var bucket0 = 0.0;
  var bucket1 = 0.0;
  var bucket2 = 0.0;
  var bucket3 = 0.0;

  for (var row = 0; row < ${TILE_SIZE}; row += 1) {
    for (var column = 0; column < ${TILE_SIZE}; column += 1) {
      let sample = textureLoad(sobelTex, tileBase + vec2<i32>(column, row), 0);
      let direction = classifyDirection(sample.x, sample.y);

      if (direction == 0) {
        bucket0 += 1.0;
      } else if (direction == 1) {
        bucket1 += 1.0;
      } else if (direction == 2) {
        bucket2 += 1.0;
      } else if (direction == 3) {
        bucket3 += 1.0;
      }
    }
  }

  var dominantDirection = -1;
  var maxCount = 0.0;

  if (bucket0 > maxCount) {
    dominantDirection = 0;
    maxCount = bucket0;
  }

  if (bucket1 > maxCount) {
    dominantDirection = 1;
    maxCount = bucket1;
  }

  if (bucket2 > maxCount) {
    dominantDirection = 2;
    maxCount = bucket2;
  }

  if (bucket3 > maxCount) {
    dominantDirection = 3;
    maxCount = bucket3;
  }

  let totalCount = bucket0 + bucket1 + bucket2 + bucket3;
  var secondCount = 0.0;

  if (dominantDirection != 0 && bucket0 > secondCount) {
    secondCount = bucket0;
  }

  if (dominantDirection != 1 && bucket1 > secondCount) {
    secondCount = bucket1;
  }

  if (dominantDirection != 2 && bucket2 > secondCount) {
    secondCount = bucket2;
  }

  if (dominantDirection != 3 && bucket3 > secondCount) {
    secondCount = bucket3;
  }

  if (maxCount < params.flags.w || dominantDirection < 0) {
    glyphs[index] = vec4<f32>(0.0);
    return;
  }

  glyphs[index] = vec4<f32>(f32(dominantDirection + 1), maxCount, totalCount, secondCount);
}
`;

const COLOR_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var downscaleTex: texture_2d<f32>;
@group(0) @binding(2) var normalsTex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read_write> colors: array<vec4<f32>>;

@compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;
  let downscale = textureLoad(downscaleTex, vec2<i32>(i32(id.x), i32(id.y)), 0);
  let center = vec2<i32>(i32(id.x) * ${TILE_SIZE} + ${TILE_SIZE / 2}, i32(id.y) * ${TILE_SIZE} + ${TILE_SIZE / 2});
  let normals = textureLoad(normalsTex, center, 0);
  let z = normals.a * 1000.0;

  let baseAsciiColor = mix(params.asciiColor.rgb, downscale.rgb, params.effect0.z);
  let fogValue = params.effect0.w * ${FOG_SCALE} * max(0.0, z - params.effect1.x);
  let fogFactor = exp2(-(fogValue * fogValue));
  let finalColor = mix(params.backgroundColor.rgb, baseAsciiColor, fogFactor);

  colors[index] = vec4<f32>(clamp(finalColor, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

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
  effect?: AcerolaAsciiNodeOptions;
}

type ThreeAsciiReadbackStrategy = NonNullable<ThreeAsciiRendererOptions["readbackStrategy"]>;

/** Raw image frame emitted by the Acerola three Ascii renderer. */
export interface ThreeAsciiImageFrame {
  data: Uint8Array;
  encoding: "bytes";
  format: 32;
  pixelWidth: number;
  pixelHeight: number;
}

/** Output selection for one three Ascii renderer pass. */
export interface ThreeAsciiRenderFrameOptions {
  ansi?: boolean;
  image?: boolean;
}

/** Combined render output from one three Ascii renderer pass. */
export interface ThreeAsciiRenderFrame {
  grid?: string[][];
  gridRevision?: number;
  image?: ThreeAsciiImageFrame;
}

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
  private outputCellCount = 0;
  private sizeDirty = true;
  private computeDirty = true;
  private uniformDirty = true;
  private lastPerformance?: ThreeAsciiRendererPerformance;
  private lastReadbackMs = 0;
  private lastAssemblyMs = 0;
  private gridRevision = 0;

  constructor(options: ThreeAsciiRendererOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.columns = Math.max(1, Math.floor(options.columns));
    this.rows = Math.max(1, Math.floor(options.rows));
    this.pixelAspectRatio = options.pixelAspectRatio ?? DEFAULT_PIXEL_ASPECT_RATIO;
    this.effectOptions = { ...options.effect };
    this.terminalEdgeBias = Math.max(0.5, options.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    this.terminalGlyphStyle = options.terminalGlyphStyle ?? "blocks";
    this.readbackStrategy = options.readbackStrategy ?? "blocking";
    this.deferredReadbacks = new ThreeAsciiDeferredReadbackQueue<GPUBuffer>({
      mapModeRead: GPU_MAP_READ,
      slotCount: options.deferredReadbackSlots ?? DEFAULT_DEFERRED_READBACK_SLOTS,
    });
    this.canvas = new HeadlessCanvas(1, 1);
  }

  async init(): Promise<void> {
    this.initPromise ??= this.initInternal();
    await this.initPromise;
  }

  setSize(columns: number, rows: number): void {
    const nextColumns = Math.max(1, Math.floor(columns));
    const nextRows = Math.max(1, Math.floor(rows));

    if (this.columns === nextColumns && this.rows === nextRows) {
      return;
    }

    this.columns = nextColumns;
    this.rows = nextRows;
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
    const next = Math.max(0.5, value);
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
    const renderAnsi = options.ansi ?? true;
    const renderImage = options.image ?? false;

    if (this.columns <= 0 || this.rows <= 0) {
      return { grid: renderAnsi ? [] : undefined };
    }

    let deferredAnsiGrid: ThreeAsciiDeferredReadbackConsumeResult | undefined;
    if (renderAnsi && !renderImage && this.readbackStrategy === "deferred") {
      deferredAnsiGrid = this.consumeDeferredAnsiGrid();
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
      frame.image = {
        data: await this.canvas.context.readRGBA(),
        encoding: "bytes",
        format: 32,
        pixelWidth: this.canvas.width,
        pixelHeight: this.canvas.height,
      };
    }

    if (renderAnsi) {
      frame.grid = await this.computeAnsiGrid(deferredAnsiGrid);
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
      workgroupSize: WORKGROUP_SIZE,
      includeEdges: includeTerminalEdges,
    });
    for (const pass of dispatchPlan.passes) {
      this.dispatchComputePass(
        commandEncoder,
        pass.label,
        this.computePipelineForPass(pass.kind),
        this.computeBindGroupForPass(pass.kind),
        dispatchPlan.workgroupsX,
        dispatchPlan.workgroupsY,
      );
    }

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

    if (this.readbackStrategy === "deferred") {
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

    return await this.buildAnsiGridFromReadback(readbackLayout, effectState.backgroundColor);
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
      this.outputReadback = this.ensureReadbackBuffer(this.outputReadback, readbackLayout.byteLength);
      this.copyReadbackCommands(commandEncoder, readbackCopyPlan, this.outputReadback);
      this.device!.queue.submit([commandEncoder.finish()]);
      return await this.buildAnsiGridFromReadback(readbackLayout, backgroundColor);
    }

    const readback = this.deferredReadbacks.nextBuffer(
      readbackLayout.byteLength,
      (current, byteLength) => this.ensureReadbackBuffer(current, byteLength),
    );
    if (!readback) {
      return completed.grid ?? this.deferredReadbacks.lastCompletedGrid();
    }

    this.copyReadbackCommands(commandEncoder, readbackCopyPlan, readback);
    this.device!.queue.submit([commandEncoder.finish()]);
    this.deferredReadbacks.queue(readback, {
      layout: readbackLayout,
      columns: this.columns,
      rows: this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      terminalEdgeBias: this.terminalEdgeBias,
      backgroundColor: backgroundColor.clone(),
    });
    return completed.grid ?? this.deferredReadbacks.lastCompletedGrid();
  }

  private consumeDeferredAnsiGrid(): ThreeAsciiDeferredReadbackConsumeResult {
    let completed: ThreeAsciiDeferredReadbackConsumeResult;
    try {
      completed = this.deferredReadbacks.consumeCompleted(
        (pending) => this.buildAnsiGridFromMappedReadback(pending),
        (error) => new ThreeAsciiReadbackError(error),
      );
    } catch (error) {
      if (error instanceof ThreeAsciiReadbackError) {
        this.readbackStrategy = "blocking";
        this.deferredReadbacks.destroy();
        this.lastReadbackMs = 0;
        return {};
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
    if (!readback) {
      throw new Error("ThreeAsciiRenderer readback buffer has not been initialized.");
    }
    const copySources = {
      fill: this.fillOutput!.gpu,
      edge: this.edgeOutput?.gpu,
      color: this.colorOutput!.gpu,
    };
    for (const command of readbackCopyPlan.commands) {
      const source = copySources[command.label];
      if (!source) {
        throw new Error(`ThreeAsciiRenderer missing ${command.label} output buffer for readback.`);
      }
      commandEncoder.copyBufferToBuffer(
        source,
        0,
        readback.gpu,
        command.targetOffset,
        command.byteLength,
      );
    }
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
    const device = await getCompatibleWebGPUDevice();
    const renderer = new WebGPURenderer({
      alpha: false,
      antialias: false,
      canvas: this.canvas as any,
      context: this.canvas.getContext("webgpu") as any,
      device,
    }) as ThreeBackendRenderer;

    renderer.setPixelRatio(1);
    renderer.setSize(TILE_SIZE, TILE_SIZE);
    await renderer.init();

    const scenePass = pass(this.scene, this.camera);
    const luts = await loadAsciiLutTextures(
      new URL("./assets/edgesASCII.png", import.meta.url),
      new URL("./assets/fillASCII.png", import.meta.url),
    );

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

    this.renderer.setSize(this.columns * TILE_SIZE, this.rows * TILE_SIZE);
    this.sizeDirty = false;
    this.computeDirty = true;
  }

  private updateCameraAspect(): void {
    if (!(this.camera instanceof PerspectiveCamera)) {
      return;
    }

    const aspect = (this.columns * this.pixelAspectRatio) / Math.max(1, this.rows);

    if (Math.abs(this.camera.aspect - aspect) > 0.000001) {
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
      this.fillPipeline = this.createComputePipeline("deno_tui.three_ascii.fill", FILL_SHADER);
      this.colorPipeline = this.createComputePipeline("deno_tui.three_ascii.color", COLOR_SHADER);
    }

    if (includeTerminalEdges && !this.edgePipeline) {
      this.edgePipeline = this.createComputePipeline("deno_tui.three_ascii.edge", EDGE_SHADER);
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
      this.outputCellCount = resourcePlan.cellCount;
      this.computeDirty = true;
    }

    if (resourcePlan.ensureEdgeOutput) {
      this.edgeOutput = this.ensureStorageBufferSlot(
        this.edgeOutput,
        resourcePlan.edgeByteLength,
        "edge",
      );
      if (resourcePlan.dirty) {
        this.computeDirty = true;
      }
    } else if (resourcePlan.releaseEdgeOutput) {
      this.edgeOutput = destroyThreeAsciiGpuBufferSlot(this.edgeOutput);
      this.edgeBindGroup = undefined;
      this.computeDirty = true;
    }

    if (!this.computeDirty) {
      return;
    }

    const downscaleTexture = this.getGpuTexture(this.asciiNode.downscaleTarget.texture);
    const normalsTexture = this.getGpuTexture(this.asciiNode.normalsTarget.texture);

    this.fillBindGroup = this.device.createBindGroup({
      label: "deno_tui.three_ascii.fill.bindings",
      layout: this.fillPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: downscaleTexture.createView() },
        { binding: 2, resource: { buffer: this.fillOutput!.gpu } },
      ],
    });

    if (includeTerminalEdges) {
      const sobelTexture = this.getGpuTexture(this.asciiNode.sobelTarget.texture);
      this.edgeBindGroup = this.device.createBindGroup({
        label: "deno_tui.three_ascii.edge.bindings",
        layout: this.edgePipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: sobelTexture.createView() },
          { binding: 2, resource: { buffer: this.edgeOutput!.gpu } },
        ],
      });
    } else {
      this.edgeBindGroup = undefined;
    }

    this.colorBindGroup = this.device.createBindGroup({
      label: "deno_tui.three_ascii.color.bindings",
      layout: this.colorPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: downscaleTexture.createView() },
        { binding: 2, resource: normalsTexture.createView() },
        { binding: 3, resource: { buffer: this.colorOutput!.gpu } },
      ],
    });

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
      tileSize: TILE_SIZE,
      terminalEdgeBias: this.terminalEdgeBias,
      terminalEdgeThresholdScale: TERMINAL_EDGE_THRESHOLD_SCALE,
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

  private createComputePipeline(label: string, code: string): GPUComputePipeline {
    const module = this.device!.createShaderModule({
      label: `${label}.wgsl`,
      code,
    });

    return this.device!.createComputePipeline({
      label,
      layout: "auto",
      compute: {
        module,
        entryPoint: "main",
      },
    });
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
    const assemblyStart = performance.now();
    const source = pending.slot.gpu.getMappedRange();
    const views = this.readbackViewCache.resolve(source, pending.layout);
    const grid = this.ansiGridAssembler.build({
      columns: pending.columns,
      rows: pending.rows,
      fillGlyphs: views.fillGlyphs,
      edgeGlyphs: views.edgeGlyphs,
      colors: views.colors,
      terminalGlyphStyle: pending.terminalGlyphStyle,
      terminalEdgeBias: pending.terminalEdgeBias,
      backgroundColor: pending.backgroundColor,
    });
    this.gridRevision += 1;
    this.lastAssemblyMs = performance.now() - assemblyStart;
    return grid;
  }

  private dispatchComputePass(
    commandEncoder: GPUCommandEncoder,
    label: string,
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    workgroupsX: number,
    workgroupsY: number,
  ): void {
    const passEncoder = commandEncoder.beginComputePass({ label });
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    passEncoder.end();
  }

  private async buildAnsiGridFromReadback(
    layout: ThreeAsciiReadbackLayout,
    backgroundColor: Color,
  ): Promise<string[][]> {
    const readback = this.outputReadback;
    if (!readback || !this.fillOutput || !this.colorOutput || (layout.edgeOffset !== undefined && !this.edgeOutput)) {
      throw new Error("ThreeAsciiRenderer readback buffers have not been initialized.");
    }

    try {
      const readbackStart = performance.now();
      await readback.gpu.mapAsync(GPUMapMode.READ);
      const readbackEnd = performance.now();
      this.lastReadbackMs = readbackEnd - readbackStart;
    } catch (error) {
      throw new ThreeAsciiReadbackError(error);
    }

    try {
      const assemblyStart = performance.now();
      const source = readback.gpu.getMappedRange();
      const views = this.readbackViewCache.resolve(source, layout);
      const grid = this.ansiGridAssembler.build({
        columns: this.columns,
        rows: this.rows,
        fillGlyphs: views.fillGlyphs,
        edgeGlyphs: views.edgeGlyphs,
        colors: views.colors,
        terminalGlyphStyle: this.terminalGlyphStyle,
        terminalEdgeBias: this.terminalEdgeBias,
        backgroundColor,
      });
      this.gridRevision += 1;
      this.lastAssemblyMs = performance.now() - assemblyStart;
      return grid;
    } finally {
      readback.gpu.unmap();
    }
  }
}
