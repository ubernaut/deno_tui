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

interface GpuBufferSlot {
  gpu: GPUBuffer;
  byteLength: number;
}

interface ReadbackBuffer {
  gpu: GPUBuffer;
  byteLength: number;
}

interface EffectState {
  edges: boolean;
  fill: boolean;
  invertLuminance: boolean;
  exposure: number;
  attenuation: number;
  blendWithBase: number;
  depthFalloff: number;
  depthOffset: number;
  edgeThreshold: number;
  asciiColor: Color;
  backgroundColor: Color;
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
  effect?: AcerolaAsciiNodeOptions;
}

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
  private fillOutput?: GpuBufferSlot;
  private edgeOutput?: GpuBufferSlot;
  private colorOutput?: GpuBufferSlot;
  private outputReadback?: ReadbackBuffer;
  private uniformValues = new Float32Array(24);
  private readonly ansiGridAssembler = new ThreeAsciiAnsiGridAssembler({ reuseGrid: true });
  private outputCellCount = 0;
  private sizeDirty = true;
  private computeDirty = true;

  constructor(options: ThreeAsciiRendererOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.columns = Math.max(1, Math.floor(options.columns));
    this.rows = Math.max(1, Math.floor(options.rows));
    this.pixelAspectRatio = options.pixelAspectRatio ?? DEFAULT_PIXEL_ASPECT_RATIO;
    this.effectOptions = { ...options.effect };
    this.terminalEdgeBias = Math.max(0.5, options.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    this.terminalGlyphStyle = options.terminalGlyphStyle ?? "blocks";
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
  }

  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void {
    if (options.asciiColor !== undefined) {
      this.effectOptions.asciiColor = colorValue(options.asciiColor, 0xffffff);
    }

    if (options.backgroundColor !== undefined) {
      this.effectOptions.backgroundColor = colorValue(options.backgroundColor, 0x000000);
    }

    for (const [key, value] of Object.entries(options)) {
      if (value === undefined || key === "asciiColor" || key === "backgroundColor") {
        continue;
      }

      (this.effectOptions as Record<string, unknown>)[key] = value;
    }

    this.asciiNode?.applyOptions(options);
    this.computeDirty = true;
  }

  getTerminalEdgeBias(): number {
    return this.terminalEdgeBias;
  }

  setTerminalEdgeBias(value: number): void {
    this.terminalEdgeBias = Math.max(0.5, value);
    this.computeDirty = true;
  }

  getTerminalGlyphStyle(): TerminalGlyphStyle {
    return this.terminalGlyphStyle;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
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
    const renderAnsi = options.ansi ?? true;
    const renderImage = options.image ?? false;

    if (this.columns <= 0 || this.rows <= 0) {
      return { grid: renderAnsi ? [] : undefined };
    }

    await this.renderScene(deltaTime, onFrame);

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
    await this.ensureComputeResources();
    const effectState = this.getEffectState();
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
    this.dispatchComputePass(
      commandEncoder,
      "deno_tui.three_ascii.edge",
      this.edgePipeline!,
      this.edgeBindGroup!,
      workgroupsX,
      workgroupsY,
    );
    this.dispatchComputePass(
      commandEncoder,
      "deno_tui.three_ascii.color",
      this.colorPipeline!,
      this.colorBindGroup!,
      workgroupsX,
      workgroupsY,
    );

    const fillOffset = 0;
    const edgeOffset = fillOffset + this.fillOutput!.byteLength;
    const colorOffset = edgeOffset + this.edgeOutput!.byteLength;
    const readbackByteLength = colorOffset + this.colorOutput!.byteLength;
    this.outputReadback = this.ensureReadbackBuffer(this.outputReadback, readbackByteLength);

    commandEncoder.copyBufferToBuffer(
      this.fillOutput!.gpu,
      0,
      this.outputReadback.gpu,
      fillOffset,
      this.fillOutput!.byteLength,
    );
    commandEncoder.copyBufferToBuffer(
      this.edgeOutput!.gpu,
      0,
      this.outputReadback.gpu,
      edgeOffset,
      this.edgeOutput!.byteLength,
    );
    commandEncoder.copyBufferToBuffer(
      this.colorOutput!.gpu,
      0,
      this.outputReadback.gpu,
      colorOffset,
      this.colorOutput!.byteLength,
    );

    this.device!.queue.submit([commandEncoder.finish()]);

    return await this.buildAnsiGridFromReadback(fillOffset, edgeOffset, colorOffset, effectState.backgroundColor);
  }

  destroy(): void {
    this.fillOutput = this.destroyBufferSlot(this.fillOutput);
    this.edgeOutput = this.destroyBufferSlot(this.edgeOutput);
    this.colorOutput = this.destroyBufferSlot(this.colorOutput);
    this.outputReadback = this.destroyReadbackBuffer(this.outputReadback);
    this.paramsBuffer?.destroy();
    this.paramsBuffer = undefined;

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

  private async ensureComputeResources(): Promise<void> {
    if (!this.device || !this.renderer || !this.asciiNode) {
      throw new Error("ThreeAsciiRenderer has not been initialized.");
    }

    if (!this.fillPipeline) {
      this.fillPipeline = this.createComputePipeline("deno_tui.three_ascii.fill", FILL_SHADER);
      this.edgePipeline = this.createComputePipeline("deno_tui.three_ascii.edge", EDGE_SHADER);
      this.colorPipeline = this.createComputePipeline("deno_tui.three_ascii.color", COLOR_SHADER);
    }

    if (!this.paramsBuffer) {
      this.paramsBuffer = this.device.createBuffer({
        label: "deno_tui.three_ascii.params",
        size: this.uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    const cellCount = this.columns * this.rows;
    if (this.outputCellCount !== cellCount) {
      this.fillOutput = this.ensureBufferSlot(this.fillOutput, cellCount * Float32Array.BYTES_PER_ELEMENT, "fill");
      this.edgeOutput = this.ensureBufferSlot(
        this.edgeOutput,
        cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
        "edge",
      );
      this.colorOutput = this.ensureBufferSlot(
        this.colorOutput,
        cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
        "color",
      );
      this.outputCellCount = cellCount;
      this.computeDirty = true;
    }

    if (!this.computeDirty) {
      return;
    }

    const downscaleTexture = this.getGpuTexture(this.asciiNode.downscaleTarget.texture);
    const sobelTexture = this.getGpuTexture(this.asciiNode.sobelTarget.texture);
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

    this.edgeBindGroup = this.device.createBindGroup({
      label: "deno_tui.three_ascii.edge.bindings",
      layout: this.edgePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: sobelTexture.createView() },
        { binding: 2, resource: { buffer: this.edgeOutput!.gpu } },
      ],
    });

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
      asciiColor: (asciiNode.asciiColor.value as Color).clone(),
      backgroundColor: (asciiNode.backgroundColor.value as Color).clone(),
    };
  }

  private writeUniforms(effectState: EffectState): void {
    const uniforms = this.uniformValues;

    uniforms[0] = this.columns;
    uniforms[1] = this.rows;
    uniforms[2] = this.columns * TILE_SIZE;
    uniforms[3] = this.rows * TILE_SIZE;

    uniforms[4] = effectState.edges ? 1 : 0;
    uniforms[5] = effectState.fill ? 1 : 0;
    uniforms[6] = effectState.invertLuminance ? 1 : 0;
    // Browser output uses sparse 8x8 bitmap masks inside each tile. A terminal
    // edge glyph fills the whole cell much more aggressively, so we bias the
    // effective threshold upward to keep fill glyphs from being overwhelmed.
    uniforms[7] = effectState.edgeThreshold * TERMINAL_EDGE_THRESHOLD_SCALE * this.terminalEdgeBias;

    uniforms[8] = effectState.exposure;
    uniforms[9] = effectState.attenuation;
    uniforms[10] = effectState.blendWithBase;
    uniforms[11] = effectState.depthFalloff;

    uniforms[12] = effectState.depthOffset;
    uniforms[13] = 0;
    uniforms[14] = 0;
    uniforms[15] = 0;

    uniforms[16] = effectState.asciiColor.r;
    uniforms[17] = effectState.asciiColor.g;
    uniforms[18] = effectState.asciiColor.b;
    uniforms[19] = 1;

    uniforms[20] = effectState.backgroundColor.r;
    uniforms[21] = effectState.backgroundColor.g;
    uniforms[22] = effectState.backgroundColor.b;
    uniforms[23] = 1;

    this.device!.queue.writeBuffer(this.paramsBuffer!, 0, uniforms);
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

  private ensureBufferSlot(current: GpuBufferSlot | undefined, byteLength: number, label: string): GpuBufferSlot {
    if (current?.byteLength === byteLength) {
      return current;
    }

    this.destroyBufferSlot(current);

    return {
      gpu: this.device!.createBuffer({
        label: `deno_tui.three_ascii.${label}.storage`,
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
      byteLength,
    };
  }

  private destroyBufferSlot(current: GpuBufferSlot | undefined): undefined {
    current?.gpu.destroy();
    return undefined;
  }

  private ensureReadbackBuffer(current: ReadbackBuffer | undefined, byteLength: number): ReadbackBuffer {
    if (current?.byteLength === byteLength) {
      return current;
    }

    this.destroyReadbackBuffer(current);

    return {
      gpu: this.device!.createBuffer({
        label: "deno_tui.three_ascii.output.readback",
        size: byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
      byteLength,
    };
  }

  private destroyReadbackBuffer(current: ReadbackBuffer | undefined): undefined {
    current?.gpu.destroy();
    return undefined;
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
    fillOffset: number,
    edgeOffset: number,
    colorOffset: number,
    backgroundColor: Color,
  ): Promise<string[][]> {
    const readback = this.outputReadback;
    const fillOutput = this.fillOutput;
    const edgeOutput = this.edgeOutput;
    const colorOutput = this.colorOutput;
    if (!readback || !fillOutput || !edgeOutput || !colorOutput) {
      throw new Error("ThreeAsciiRenderer readback buffers have not been initialized.");
    }

    await readback.gpu.mapAsync(GPUMapMode.READ);

    try {
      const source = readback.gpu.getMappedRange();
      return this.ansiGridAssembler.build({
        columns: this.columns,
        rows: this.rows,
        fillGlyphs: new Float32Array(source, fillOffset, fillOutput.byteLength / Float32Array.BYTES_PER_ELEMENT),
        edgeGlyphs: new Float32Array(source, edgeOffset, edgeOutput.byteLength / Float32Array.BYTES_PER_ELEMENT),
        colors: new Float32Array(source, colorOffset, colorOutput.byteLength / Float32Array.BYTES_PER_ELEMENT),
        terminalGlyphStyle: this.terminalGlyphStyle,
        terminalEdgeBias: this.terminalEdgeBias,
        backgroundColor,
      });
    } finally {
      readback.gpu.unmap();
    }
  }
}
