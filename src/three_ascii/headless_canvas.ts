export class HeadlessGPUCanvasContext {
  private configuration?: GPUCanvasConfiguration;
  private texture: GPUTexture | null = null;
  private readbackBuffer: GPUBuffer | null = null;

  constructor(private readonly canvas: HeadlessCanvas) {}

  configure(configuration: GPUCanvasConfiguration): void {
    this.configuration = configuration;
    this.invalidateTexture();
  }

  getCurrentTexture(): GPUTexture {
    if (!this.configuration) {
      throw new Error("HeadlessGPUCanvasContext is not configured.");
    }

    if (!this.texture) {
      this.texture = this.configuration.device.createTexture({
        size: {
          width: Math.max(1, this.canvas.width),
          height: Math.max(1, this.canvas.height),
          depthOrArrayLayers: 1,
        },
        format: this.configuration.format,
        usage: this.configuration.usage ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC),
      });
    }

    return this.texture;
  }

  resize(): void {
    this.invalidateTexture();
  }

  async readRGBA(): Promise<Uint8Array> {
    const texture = this.getCurrentTexture();
    const { device } = this.configuration!;
    const bytesPerRow = this.canvas.width * 4;
    const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
    const bufferSize = alignedBytesPerRow * this.canvas.height;

    if (!this.readbackBuffer || this.readbackBuffer.size !== bufferSize) {
      this.readbackBuffer?.destroy();
      this.readbackBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
    }

    const encoder = device.createCommandEncoder({ label: "deno_tui.three_ascii.readback" });
    encoder.copyTextureToBuffer(
      { texture },
      {
        buffer: this.readbackBuffer,
        bytesPerRow: alignedBytesPerRow,
        rowsPerImage: this.canvas.height,
      },
      {
        width: this.canvas.width,
        height: this.canvas.height,
        depthOrArrayLayers: 1,
      },
    );
    device.queue.submit([encoder.finish()]);

    await this.readbackBuffer.mapAsync(GPUMapMode.READ);
    const source = new Uint8Array(this.readbackBuffer.getMappedRange());
    const result = new Uint8Array(this.canvas.width * this.canvas.height * 4);

    for (let row = 0; row < this.canvas.height; row += 1) {
      const srcOffset = row * alignedBytesPerRow;
      const dstOffset = row * bytesPerRow;
      result.set(source.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
    }

    this.readbackBuffer.unmap();
    return result;
  }

  destroy(): void {
    this.readbackBuffer?.destroy();
    this.readbackBuffer = null;
    this.invalidateTexture();
  }

  private invalidateTexture(): void {
    this.texture?.destroy();
    this.texture = null;
  }
}

export class HeadlessCanvas {
  style = { width: "", height: "" };
  private _width: number;
  private _height: number;
  readonly context: HeadlessGPUCanvasContext;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.context = new HeadlessGPUCanvasContext(this);
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = Math.max(1, Math.floor(value));
    this.context.resize();
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = Math.max(1, Math.floor(value));
    this.context.resize();
  }

  getContext(type: string): GPUCanvasContext | null {
    return type === "webgpu" ? this.context as unknown as GPUCanvasContext : null;
  }

  setAttribute(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
}
