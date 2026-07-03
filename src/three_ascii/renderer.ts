import { Camera, Color, PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { RenderPipeline, WebGPURenderer } from "npm:three@0.183.2/webgpu";
import { pass } from "npm:three@0.183.2/tsl";

import { AcerolaAsciiNode, type AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import {
  buildThreeAsciiAnsiGrid as buildThreeAsciiAnsiGridInternal,
  colorValue,
  ThreeAsciiAnsiGridAssembler as InternalThreeAsciiAnsiGridAssembler,
  type ThreeAsciiAnsiGridInput as InternalThreeAsciiAnsiGridInput,
} from "./ansi_grid.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import { HeadlessCanvas } from "./headless_canvas.ts";
import { loadAsciiLutTextures } from "./loadAsciiLuts.ts";
import {
  destroyThreeAsciiGpuBufferSlot,
  ensureThreeAsciiGpuBufferSlot,
  type ThreeAsciiGpuBufferSlot,
} from "./gpu_buffers.ts";
import {
  ThreeAsciiReadbackCopyPlanCache,
  type ThreeAsciiReadbackLayout,
  ThreeAsciiReadbackLayoutCache,
  ThreeAsciiReadbackViewCache,
} from "./readback.ts";
import {
  THREE_ASCII_UNIFORM_FLOAT_COUNT,
  type ThreeAsciiUniformEffectState,
  writeThreeAsciiUniformValues,
} from "./uniforms.ts";
import { getCompatibleWebGPUDevice } from "./webgpu_compat.ts";

const TILE_SIZE = 8;
const WORKGROUP_SIZE = 8;
const FOG_SCALE = 0.005 / Math.sqrt(Math.log(2));
const DEFAULT_PIXEL_ASPECT_RATIO = 0.5;
const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const TERMINAL_EDGE_THRESHOLD_SCALE = 2;
const MIN_VISIBLE_LUMINANCE = 0.015;

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

interface EffectState extends ThreeAsciiUniformEffectState {
  asciiColor: Color;
  backgroundColor: Color;
}

interface DeferredReadbackFrame {
  slot: ThreeAsciiGpuBufferSlot<GPUBuffer>;
  layout: ThreeAsciiReadbackLayout;
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  backgroundColor: Color;
  generation: number;
  resolved: boolean;
  error?: unknown;
  readbackStart: number;
  readbackMs: number;
}

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
  image?: ThreeAsciiImageFrame;
}

/** Last-frame timing breakdown for terminal Three ASCII rendering. */
export interface ThreeAsciiRendererPerformance {
  columns: number;
  rows: number;
  cells: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  totalMs: number;
  sceneMs: number;
  ansiMs: number;
  readbackMs: number;
  assemblyMs: number;
}

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
  private deferredReadbacks: Array<ThreeAsciiGpuBufferSlot<GPUBuffer> | undefined> = [];
  private pendingDeferredReadbacks: DeferredReadbackFrame[] = [];
  private nextDeferredReadbackIndex = 0;
  private lastDeferredGrid: string[][] = [];
  private deferredReadbackGeneration = 0;
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
    this.deferredReadbackGeneration += 1;
    this.lastDeferredGrid = [];
  }

  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void {
    if (options.asciiColor !== undefined) {
      this.effectOptions.asciiColor = colorValue(options.asciiColor, 0xffffff);
    }

    if (options.backgroundColor !== undefined) {
      this.effectOptions.backgroundColor = colorValue(options.backgroundColor, 0x000000);
    }

    this.applyEffectOptionPatch(options);

    this.asciiNode?.applyOptions(options);
    this.computeDirty = true;
    this.uniformDirty = true;
  }

  private applyEffectOptionPatch(options: Partial<AcerolaAsciiNodeOptions>): void {
    if (options.resolutionScale !== undefined) this.effectOptions.resolutionScale = options.resolutionScale;
    if (options.zoom !== undefined) this.effectOptions.zoom = options.zoom;
    if (options.offset !== undefined) this.effectOptions.offset = options.offset;
    if (options.kernelSize !== undefined) this.effectOptions.kernelSize = options.kernelSize;
    if (options.sigma !== undefined) this.effectOptions.sigma = options.sigma;
    if (options.sigmaScale !== undefined) this.effectOptions.sigmaScale = options.sigmaScale;
    if (options.tau !== undefined) this.effectOptions.tau = options.tau;
    if (options.threshold !== undefined) this.effectOptions.threshold = options.threshold;
    if (options.useDepth !== undefined) this.effectOptions.useDepth = options.useDepth;
    if (options.depthThreshold !== undefined) this.effectOptions.depthThreshold = options.depthThreshold;
    if (options.useNormals !== undefined) this.effectOptions.useNormals = options.useNormals;
    if (options.normalThreshold !== undefined) this.effectOptions.normalThreshold = options.normalThreshold;
    if (options.depthCutoff !== undefined) this.effectOptions.depthCutoff = options.depthCutoff;
    if (options.edgeThreshold !== undefined) this.effectOptions.edgeThreshold = options.edgeThreshold;
    if (options.edges !== undefined) this.effectOptions.edges = options.edges;
    if (options.fill !== undefined) this.effectOptions.fill = options.fill;
    if (options.exposure !== undefined) this.effectOptions.exposure = options.exposure;
    if (options.attenuation !== undefined) this.effectOptions.attenuation = options.attenuation;
    if (options.invertLuminance !== undefined) this.effectOptions.invertLuminance = options.invertLuminance;
    if (options.blendWithBase !== undefined) this.effectOptions.blendWithBase = options.blendWithBase;
    if (options.depthFalloff !== undefined) this.effectOptions.depthFalloff = options.depthFalloff;
    if (options.depthOffset !== undefined) this.effectOptions.depthOffset = options.depthOffset;
    if (options.viewDog !== undefined) this.effectOptions.viewDog = options.viewDog;
    if (options.viewUncompressed !== undefined) this.effectOptions.viewUncompressed = options.viewUncompressed;
    if (options.viewEdges !== undefined) this.effectOptions.viewEdges = options.viewEdges;
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
      frame.grid = await this.computeAnsiGrid();
    }
    const frameEnd = performance.now();
    this.lastPerformance = {
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      totalMs: frameEnd - frameStart,
      sceneMs: sceneEnd - frameStart,
      ansiMs: renderAnsi ? frameEnd - sceneEnd : 0,
      readbackMs: renderAnsi ? this.lastReadbackMs : 0,
      assemblyMs: renderAnsi ? this.lastAssemblyMs : 0,
    };

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

  private async computeAnsiGrid(): Promise<string[][]> {
    const effectState = this.getEffectState();
    const includeTerminalEdges = effectState.edges && this.terminalGlyphStyle !== "blocks";
    await this.ensureComputeResources(effectState, includeTerminalEdges);
    this.writeUniforms(effectState);

    const commandEncoder = this.device!.createCommandEncoder({
      label: "deno_tui.three_ascii.cells",
    });
    const workgroupsX = Math.ceil(this.columns / WORKGROUP_SIZE);
    const workgroupsY = Math.ceil(this.rows / WORKGROUP_SIZE);

    this.dispatchComputePass(
      commandEncoder,
      "deno_tui.three_ascii.fill",
      this.fillPipeline!,
      this.fillBindGroup!,
      workgroupsX,
      workgroupsY,
    );
    if (includeTerminalEdges) {
      this.dispatchComputePass(
        commandEncoder,
        "deno_tui.three_ascii.edge",
        this.edgePipeline!,
        this.edgeBindGroup!,
        workgroupsX,
        workgroupsY,
      );
    }
    this.dispatchComputePass(
      commandEncoder,
      "deno_tui.three_ascii.color",
      this.colorPipeline!,
      this.colorBindGroup!,
      workgroupsX,
      workgroupsY,
    );

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
      return this.deferAnsiGridReadback(commandEncoder, readbackLayout, readbackCopyPlan, effectState.backgroundColor);
    }

    this.outputReadback = this.ensureReadbackBuffer(this.outputReadback, readbackLayout.byteLength);
    this.copyReadbackCommands(commandEncoder, readbackCopyPlan, this.outputReadback);
    this.device!.queue.submit([commandEncoder.finish()]);

    return await this.buildAnsiGridFromReadback(readbackLayout, effectState.backgroundColor);
  }

  private deferAnsiGridReadback(
    commandEncoder: GPUCommandEncoder,
    readbackLayout: ThreeAsciiReadbackLayout,
    readbackCopyPlan: ReturnType<ThreeAsciiReadbackCopyPlanCache["resolve"]>,
    backgroundColor: Color,
  ): string[][] {
    const completedGrid = this.consumeCompletedDeferredReadbacks();
    const readback = this.nextDeferredReadbackBuffer(readbackLayout.byteLength);
    if (!readback) {
      return completedGrid ?? this.lastDeferredGrid;
    }

    this.copyReadbackCommands(commandEncoder, readbackCopyPlan, readback);
    this.device!.queue.submit([commandEncoder.finish()]);
    this.queueDeferredReadback(readback, readbackLayout, backgroundColor);
    return completedGrid ?? this.lastDeferredGrid;
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

  destroy(): void {
    this.fillOutput = destroyThreeAsciiGpuBufferSlot(this.fillOutput);
    this.edgeOutput = destroyThreeAsciiGpuBufferSlot(this.edgeOutput);
    this.colorOutput = destroyThreeAsciiGpuBufferSlot(this.colorOutput);
    this.outputReadback = destroyThreeAsciiGpuBufferSlot(this.outputReadback);
    this.destroyDeferredReadbacks();
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
    effectState: EffectState,
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

    const cellCount = this.columns * this.rows;
    if (this.outputCellCount !== cellCount) {
      this.fillOutput = this.ensureStorageBufferSlot(
        this.fillOutput,
        cellCount * Float32Array.BYTES_PER_ELEMENT,
        "fill",
      );
      this.colorOutput = this.ensureStorageBufferSlot(
        this.colorOutput,
        cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
        "color",
      );
      this.outputCellCount = cellCount;
      this.computeDirty = true;
    }

    if (includeTerminalEdges) {
      const hadEdgeOutput = this.edgeOutput !== undefined;
      this.edgeOutput = this.ensureStorageBufferSlot(
        this.edgeOutput,
        cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
        "edge",
      );
      if (!hadEdgeOutput || !this.edgeBindGroup) {
        this.computeDirty = true;
      }
    } else if (this.edgeOutput) {
      this.edgeOutput = destroyThreeAsciiGpuBufferSlot(this.edgeOutput);
      this.edgeBindGroup = undefined;
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

  private getEffectState(): EffectState {
    const asciiNode = this.asciiNode;

    if (!asciiNode) {
      return {
        edges: true,
        fill: true,
        invertLuminance: false,
        exposure: 1,
        attenuation: 1,
        blendWithBase: 0,
        depthFalloff: 0,
        depthOffset: 0,
        edgeThreshold: 8,
        asciiColor: colorValue(this.effectOptions.asciiColor, 0xffffff),
        backgroundColor: colorValue(this.effectOptions.backgroundColor, 0x000000),
      };
    }

    return {
      edges: Boolean(asciiNode.edges.value),
      fill: Boolean(asciiNode.fill.value),
      invertLuminance: Boolean(asciiNode.invertLuminance.value),
      exposure: Number(asciiNode.exposure.value),
      attenuation: Number(asciiNode.attenuation.value),
      blendWithBase: Number(asciiNode.blendWithBase.value),
      depthFalloff: Number(asciiNode.depthFalloff.value),
      depthOffset: Number(asciiNode.depthOffset.value),
      edgeThreshold: Number(asciiNode.edgeThreshold.value),
      asciiColor: asciiNode.asciiColor.value as Color,
      backgroundColor: asciiNode.backgroundColor.value as Color,
    };
  }

  private writeUniforms(effectState: EffectState): void {
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

  private nextDeferredReadbackBuffer(byteLength: number): ThreeAsciiGpuBufferSlot<GPUBuffer> | undefined {
    const slotCount = 2;
    for (let attempt = 0; attempt < slotCount; attempt += 1) {
      const index = (this.nextDeferredReadbackIndex + attempt) % slotCount;
      const current = this.deferredReadbacks[index];
      if (current && this.pendingDeferredReadbacks.some((pending) => pending.slot === current)) {
        continue;
      }
      const next = this.ensureReadbackBuffer(current, byteLength);
      this.deferredReadbacks[index] = next;
      this.nextDeferredReadbackIndex = (index + 1) % slotCount;
      return next;
    }
    return undefined;
  }

  private queueDeferredReadback(
    slot: ThreeAsciiGpuBufferSlot<GPUBuffer>,
    layout: ThreeAsciiReadbackLayout,
    backgroundColor: Color,
  ): void {
    const pending: DeferredReadbackFrame = {
      slot,
      layout,
      columns: this.columns,
      rows: this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      terminalEdgeBias: this.terminalEdgeBias,
      backgroundColor: backgroundColor.clone(),
      generation: this.deferredReadbackGeneration,
      resolved: false,
      readbackStart: performance.now(),
      readbackMs: 0,
    };
    this.pendingDeferredReadbacks.push(pending);
    slot.gpu.mapAsync(GPUMapMode.READ).then(
      () => {
        pending.readbackMs = performance.now() - pending.readbackStart;
        pending.resolved = true;
      },
      (error) => {
        pending.error = error;
        pending.resolved = true;
      },
    );
  }

  private consumeCompletedDeferredReadbacks(): string[][] | undefined {
    let grid: string[][] | undefined;
    for (let index = 0; index < this.pendingDeferredReadbacks.length;) {
      const pending = this.pendingDeferredReadbacks[index]!;
      if (!pending.resolved) {
        index += 1;
        continue;
      }

      this.pendingDeferredReadbacks.splice(index, 1);
      if (pending.error !== undefined) {
        throw new ThreeAsciiReadbackError(pending.error);
      }

      try {
        if (pending.generation === this.deferredReadbackGeneration) {
          grid = this.buildAnsiGridFromMappedReadback(pending);
          this.lastDeferredGrid = grid;
          this.lastReadbackMs = pending.readbackMs;
        }
      } finally {
        pending.slot.gpu.unmap();
      }
    }
    return grid;
  }

  private buildAnsiGridFromMappedReadback(pending: DeferredReadbackFrame): string[][] {
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
    this.lastAssemblyMs = performance.now() - assemblyStart;
    return grid;
  }

  private destroyDeferredReadbacks(): void {
    this.pendingDeferredReadbacks.length = 0;
    for (let index = 0; index < this.deferredReadbacks.length; index += 1) {
      this.deferredReadbacks[index] = destroyThreeAsciiGpuBufferSlot(this.deferredReadbacks[index]);
    }
    this.deferredReadbacks.length = 0;
    this.nextDeferredReadbackIndex = 0;
    this.lastDeferredGrid = [];
    this.deferredReadbackGeneration += 1;
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
      this.lastAssemblyMs = performance.now() - assemblyStart;
      return grid;
    } finally {
      readback.gpu.unmap();
    }
  }
}
