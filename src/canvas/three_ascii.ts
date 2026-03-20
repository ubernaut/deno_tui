import { emptyStyle } from "../theme.ts";
import { DrawObject, type DrawObjectOptions } from "./draw_object.ts";
import { Signal, type SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import type { Rectangle } from "../types.ts";
import type { Camera, Scene } from "npm:three@0.183.2";
import type { AcerolaAsciiNodeOptions } from "../three_ascii/AcerolaAsciiNode.ts";
import { ThreeAsciiRenderer } from "../three_ascii/renderer.ts";

export interface ThreeAsciiObjectOptions extends DrawObjectOptions {
  rectangle: Rectangle | SignalOfObject<Rectangle>;
  scene: Scene;
  camera: Camera;
  frameInterval?: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  effect?: AcerolaAsciiNodeOptions;
  onFrame?: (deltaTime: number) => void | Promise<void>;
}

export class ThreeAsciiObject extends DrawObject<"three_ascii"> {
  override rectangle: Signal<Rectangle>;
  renderer: ThreeAsciiRenderer;
  frameInterval: number;
  onFrame?: (deltaTime: number) => void | Promise<void>;
  grid: string[][] = [];

  private lastFrameTime = performance.now();
  private rendering = false;
  private running = false;

  constructor(options: ThreeAsciiObjectOptions) {
    super("three_ascii", { ...options, style: emptyStyle });

    this.rectangle = signalify(options.rectangle, { deepObserve: true });
    this.renderer = new ThreeAsciiRenderer({
      scene: options.scene,
      camera: options.camera,
      columns: options.rectangle instanceof Signal ? options.rectangle.peek().width : options.rectangle.width,
      rows: options.rectangle instanceof Signal ? options.rectangle.peek().height : options.rectangle.height,
      pixelAspectRatio: options.pixelAspectRatio,
      terminalEdgeBias: options.terminalEdgeBias,
      effect: options.effect,
    });
    this.frameInterval = options.frameInterval ?? 1000 / 24;
    this.onFrame = options.onFrame;
  }

  override draw(): void {
    this.rectangle.subscribe(this.handleResize);
    this.running = true;
    super.draw();
    queueMicrotask(() => void this.renderLoop());
  }

  override erase(): void {
    this.running = false;
    this.rectangle.unsubscribe(this.handleResize);
    this.renderer.destroy();
    super.erase();
  }

  override rerender(): void {
    const { frameBuffer, rerenderQueue } = this.canvas;
    const rectangle = this.rectangle.peek();
    const { columns, rows } = this.canvas.size.peek();

    const rowLimit = Math.min(rows, rectangle.row + rectangle.height);
    const columnLimit = Math.min(columns, rectangle.column + rectangle.width);

    for (let row = rectangle.row; row < rowLimit; row += 1) {
      const rerenderColumns = this.rerenderCells[row];
      if (!rerenderColumns?.size) continue;

      const outputRow = this.grid[row - rectangle.row];
      const frameRow = frameBuffer[row] ??= [];
      const queueRow = rerenderQueue[row] ??= new Set();

      for (const column of rerenderColumns) {
        if (column < rectangle.column || column >= columnLimit) continue;
        frameRow[column] = outputRow?.[column - rectangle.column] ?? " ";
        queueRow.add(column);
      }

      rerenderColumns.clear();
    }
  }

  private readonly handleResize = (rectangle: Rectangle) => {
    this.renderer.setSize(rectangle.width, rectangle.height);
    this.moved = true;
    this.updated = false;
    this.canvas.updateObjects.push(this);
  };

  setEffectOptions(options: Partial<AcerolaAsciiNodeOptions>): void {
    this.renderer.setEffectOptions(options);
  }

  getTerminalEdgeBias(): number {
    return this.renderer.getTerminalEdgeBias();
  }

  setTerminalEdgeBias(value: number): void {
    this.renderer.setTerminalEdgeBias(value);
  }

  private async renderLoop(): Promise<void> {
    if (!this.running || this.rendering) return;

    this.rendering = true;

    try {
      const rectangle = this.rectangle.peek();
      if (rectangle.width > 0 && rectangle.height > 0) {
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.renderer.setSize(rectangle.width, rectangle.height);
        this.grid = await this.renderer.renderToAnsiGrid(deltaTime, this.onFrame);

        for (let row = rectangle.row; row < rectangle.row + rectangle.height; row += 1) {
          for (let column = rectangle.column; column < rectangle.column + rectangle.width; column += 1) {
            this.queueRerender(row, column);
          }
        }

        this.updated = false;
        this.canvas.updateObjects.push(this);
      }
    } finally {
      this.rendering = false;

      if (this.running) {
        setTimeout(() => void this.renderLoop(), this.frameInterval);
      }
    }
  }
}
