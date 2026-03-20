import {
  Camera,
  Color,
  PerspectiveCamera,
  Scene,
} from "npm:three@0.183.2";
import { RenderPipeline, WebGPURenderer } from "npm:three@0.183.2/webgpu";
import { pass } from "npm:three@0.183.2/tsl";

import {
  AcerolaAsciiNode,
  type AcerolaAsciiNodeOptions,
} from "./AcerolaAsciiNode.ts";
import { TERMINAL_GLYPHS } from "./glyphs.ts";
import { HeadlessCanvas } from "./headless_canvas.ts";
import { loadAsciiLutTextures } from "./loadAsciiLuts.ts";
import { getCompatibleWebGPUDevice } from "./webgpu_compat.ts";

const TILE_SIZE = 8;
const WORKGROUP_SIZE = 8;
const TILE_PIXEL_COUNT = TILE_SIZE * TILE_SIZE;
const FOG_SCALE = 0.005 / Math.sqrt(Math.log(2));
const DEFAULT_PIXEL_ASPECT_RATIO = 0.5;
const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const TERMINAL_EDGE_THRESHOLD_SCALE = 2;
const RESET = "\x1b[0m";
const GOHU_11_EDGE_SHAPE_MISMATCH = [0, 3, 10, 9] as const;
const GOHU_11_FILL_GLYPH_COVERAGE = [0, 1, 4, 9, 12, 9, 11, 6, 12, 18] as const;

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
  var fillBucket = clamp(i32(floor(luminanceValue * 10.0 - 0.000001)) - 1, i32(0), i32(9));

  if (params.flags.z > 0.5) {
    fillBucket = 9 - fillBucket;
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

interface BufferPair {
  gpu: GPUBuffer;
  readback: GPUBuffer;
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

export interface ThreeAsciiRendererOptions {
  scene: Scene;
  camera: Camera;
  columns: number;
  rows: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  effect?: AcerolaAsciiNodeOptions;
}

function colorValue(input: Color | string | number | undefined, fallback: number): Color {
  return input instanceof Color ? input.clone() : new Color(input ?? fallback);
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function colorToBytes(color: Color): [number, number, number] {
  return [
    Math.round(linearToSrgb(color.r) * 255),
    Math.round(linearToSrgb(color.g) * 255),
    Math.round(linearToSrgb(color.b) * 255),
  ];
}

function linearRgbToBytes(red: number, green: number, blue: number): [number, number, number] {
  return [
    Math.round(linearToSrgb(red) * 255),
    Math.round(linearToSrgb(green) * 255),
    Math.round(linearToSrgb(blue) * 255),
  ];
}

function rgbToAnsiForeground(red: number, green: number, blue: number): string {
  return `\x1b[38;2;${red};${green};${blue}m`;
}

function rgbToAnsiBackground(red: number, green: number, blue: number): string {
  return `\x1b[48;2;${red};${green};${blue}m`;
}

function clampGlyphIndex(index: number): number {
  return Math.max(0, Math.min(TERMINAL_GLYPHS.length - 1, index));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fillCoverageForGohu11(fillGlyphIndex: number): number {
  if (fillGlyphIndex < 5) {
    return 0;
  }

  const bucket = Math.max(0, Math.min(GOHU_11_FILL_GLYPH_COVERAGE.length - 1, fillGlyphIndex - 5));
  return GOHU_11_FILL_GLYPH_COVERAGE[bucket] / TILE_PIXEL_COUNT;
}

function shouldUseGohu11EdgeGlyph(
  edgeGlyphIndex: number,
  dominantCount: number,
  totalCount: number,
  secondCount: number,
  fillGlyphIndex: number,
  edgeBias = DEFAULT_TERMINAL_EDGE_BIAS,
): boolean {
  const direction = edgeGlyphIndex - 1;
  if (direction < 0 || direction >= GOHU_11_EDGE_SHAPE_MISMATCH.length || dominantCount <= 0 || totalCount <= 0) {
    return false;
  }

  // Gohu 11 matches the LUT vertical/horizontal marks reasonably well, but
  // the diagonal glyphs are visually louder and a poorer bitmap match. Bias
  // edge promotion toward clearly dominant, well-separated edge buckets.
  const mismatchWeight = GOHU_11_EDGE_SHAPE_MISMATCH[direction] / 48;
  const directionShare = dominantCount / totalCount;
  const separation = secondCount > 0 ? (dominantCount - secondCount) / dominantCount : 1;
  const dominantCoverage = dominantCount / TILE_PIXEL_COUNT;
  const fillCoverage = fillCoverageForGohu11(fillGlyphIndex);
  const clampedBias = Math.max(0.5, edgeBias);
  const biasOffset = clampedBias - 1;

  const minShare = 0.54 + mismatchWeight * 0.6 + biasOffset * 0.12;
  const minSeparation = 0.12 + mismatchWeight * 0.55 + biasOffset * 0.18;
  const minCoverage = 0.09 + fillCoverage * 0.14 + mismatchWeight * 0.08 + biasOffset * 0.06;

  return (
    directionShare >= clampUnit(minShare) &&
    separation >= clampUnit(minSeparation) &&
    dominantCoverage >= clampUnit(minCoverage)
  );
}

export class ThreeAsciiRenderer {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly pixelAspectRatio: number;

  columns: number;
  rows: number;

  private readonly effectOptions: AcerolaAsciiNodeOptions;
  private readonly canvas: HeadlessCanvas;
  private terminalEdgeBias: number;

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
  private fillOutput?: BufferPair;
  private edgeOutput?: BufferPair;
  private colorOutput?: BufferPair;
  private uniformValues = new Float32Array(24);
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

  async renderToAnsiGrid(
    deltaTime = 0,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    if (this.columns <= 0 || this.rows <= 0) {
      return [];
    }

    await this.init();

    if (onFrame) {
      await onFrame(deltaTime);
    }

    this.applySize();
    this.updateCameraAspect();

    this.renderPipeline!.render();

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

    commandEncoder.copyBufferToBuffer(
      this.fillOutput!.gpu,
      0,
      this.fillOutput!.readback,
      0,
      this.fillOutput!.byteLength,
    );
    commandEncoder.copyBufferToBuffer(
      this.edgeOutput!.gpu,
      0,
      this.edgeOutput!.readback,
      0,
      this.edgeOutput!.byteLength,
    );
    commandEncoder.copyBufferToBuffer(
      this.colorOutput!.gpu,
      0,
      this.colorOutput!.readback,
      0,
      this.colorOutput!.byteLength,
    );

    this.device!.queue.submit([commandEncoder.finish()]);

    const [fillGlyphs, edgeGlyphs, colors] = await Promise.all([
      this.readFloatBuffer(this.fillOutput!),
      this.readFloat4Buffer(this.edgeOutput!),
      this.readFloat4Buffer(this.colorOutput!),
    ]);

    const [backgroundRed, backgroundGreen, backgroundBlue] = colorToBytes(effectState.backgroundColor);
    const backgroundAnsi = rgbToAnsiBackground(backgroundRed, backgroundGreen, backgroundBlue);

    const grid = Array.from({ length: this.rows }, () => Array<string>(this.columns));

    for (let row = 0; row < this.rows; row += 1) {
      const outputRow = grid[row];

      for (let column = 0; column < this.columns; column += 1) {
        const index = row * this.columns + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        const edgeOffset = index * 4;
        const edgeGlyphIndex = Math.round(edgeGlyphs[edgeOffset] ?? 0);
        const glyphIndex = clampGlyphIndex(
          shouldUseGohu11EdgeGlyph(
            edgeGlyphIndex,
            edgeGlyphs[edgeOffset + 1] ?? 0,
            edgeGlyphs[edgeOffset + 2] ?? 0,
            edgeGlyphs[edgeOffset + 3] ?? 0,
            fillGlyphIndex,
            this.terminalEdgeBias,
          )
            ? edgeGlyphIndex
            : fillGlyphIndex,
        );
        const glyph = TERMINAL_GLYPHS[glyphIndex] ?? " ";

        const colorOffset = index * 4;
        const [foregroundRed, foregroundGreen, foregroundBlue] = linearRgbToBytes(
          Math.max(0, Math.min(1, colors[colorOffset] ?? 0)),
          Math.max(0, Math.min(1, colors[colorOffset + 1] ?? 0)),
          Math.max(0, Math.min(1, colors[colorOffset + 2] ?? 0)),
        );
        const foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);

        outputRow[column] = `${backgroundAnsi}${foregroundAnsi}${glyph}${RESET}`;
      }
    }

    return grid;
  }

  destroy(): void {
    this.fillOutput = this.destroyBufferPair(this.fillOutput);
    this.edgeOutput = this.destroyBufferPair(this.edgeOutput);
    this.colorOutput = this.destroyBufferPair(this.colorOutput);
    this.paramsBuffer?.destroy();
    this.paramsBuffer = undefined;

    this.renderPipeline?.dispose();
    this.renderPipeline = undefined;

    this.asciiNode?.dispose();
    this.asciiNode = undefined;

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
      this.fillOutput = this.ensureBufferPair(this.fillOutput, cellCount * Float32Array.BYTES_PER_ELEMENT, "fill");
      this.edgeOutput = this.ensureBufferPair(
        this.edgeOutput,
        cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
        "edge",
      );
      this.colorOutput = this.ensureBufferPair(
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

  private ensureBufferPair(current: BufferPair | undefined, byteLength: number, label: string): BufferPair {
    if (current?.byteLength === byteLength) {
      return current;
    }

    this.destroyBufferPair(current);

    return {
      gpu: this.device!.createBuffer({
        label: `deno_tui.three_ascii.${label}.storage`,
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
      readback: this.device!.createBuffer({
        label: `deno_tui.three_ascii.${label}.readback`,
        size: byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
      byteLength,
    };
  }

  private destroyBufferPair(current: BufferPair | undefined): undefined {
    current?.gpu.destroy();
    current?.readback.destroy();
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

  private async readFloatBuffer(bufferPair: BufferPair): Promise<Float32Array> {
    await bufferPair.readback.mapAsync(GPUMapMode.READ);

    try {
      const source = new Float32Array(bufferPair.readback.getMappedRange());
      const result = new Float32Array(source.length);
      result.set(source);
      return result;
    } finally {
      bufferPair.readback.unmap();
    }
  }

  private async readFloat4Buffer(bufferPair: BufferPair): Promise<Float32Array> {
    return await this.readFloatBuffer(bufferPair);
  }
}
