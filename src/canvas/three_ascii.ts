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
  private destroyPending = false;
  private failed = false;

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
    this.failed = false;
    this.destroyPending = false;
    super.draw();
    queueMicrotask(() => void this.renderLoop());
  }

  override erase(): void {
    this.running = false;
    this.rectangle.unsubscribe(this.handleResize);
    if (this.rendering) {
      this.destroyPending = true;
    } else {
      this.renderer.destroy();
    }
    super.erase();
  }

  override rerender(): void {
    const { frameBuffer, rerenderQueue } = this.canvas;
    const rectangle = this.rectangle.peek();
    const { columns, rows } = this.canvas.size.peek();
    const viewRectangle = this.view.peek()?.rectangle?.peek();

    let rowLimit = Math.min(rows, rectangle.row + rectangle.height);
    let columnLimit = Math.min(columns, rectangle.column + rectangle.width);

    if (viewRectangle) {
      rowLimit = Math.min(rowLimit, viewRectangle.row + viewRectangle.height);
      columnLimit = Math.min(columnLimit, viewRectangle.column + viewRectangle.width);
    }

    for (let row = rectangle.row; row < rowLimit; row += 1) {
      const rerenderColumns = this.rerenderCells[row];
      if (!rerenderColumns?.size) continue;

      const outputRow = this.grid[row - rectangle.row];
      const frameRow = frameBuffer[row] ??= [];
      const queueRow = rerenderQueue[row] ??= new Set();
      const omitColumns = this.omitCells[row];

      for (const column of rerenderColumns) {
        if (column < rectangle.column || column >= columnLimit || omitColumns?.has(column)) continue;
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

  isOperational(): boolean {
    return !this.failed;
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

        if (!this.running) {
          return;
        }

        for (let row = rectangle.row; row < rectangle.row + rectangle.height; row += 1) {
          for (let column = rectangle.column; column < rectangle.column + rectangle.width; column += 1) {
            this.queueRerender(row, column);
          }
        }

        this.updated = false;
        this.canvas.updateObjects.push(this);
      }
    } catch (error) {
      this.failed = true;
      this.running = false;
      const rectangle = this.rectangle.peek();
      this.grid = buildFallbackGrid(
        rectangle.width,
        rectangle.height,
        error instanceof Error ? error.message : "ASCII RENDERER OFFLINE",
      );
      for (let row = rectangle.row; row < rectangle.row + rectangle.height; row += 1) {
        for (let column = rectangle.column; column < rectangle.column + rectangle.width; column += 1) {
          this.queueRerender(row, column);
        }
      }
      this.updated = false;
      this.canvas.updateObjects.push(this);
    } finally {
      this.rendering = false;

      if (this.destroyPending) {
        this.renderer.destroy();
        this.destroyPending = false;
      }

      if (this.running) {
        setTimeout(() => void this.renderLoop(), this.frameInterval);
      }
    }
  }
}

function buildFallbackGrid(width: number, height: number, detail: string): string[][] {
  const columns = Math.max(1, width);
  const rows = Math.max(1, height);
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => " "));
  const lines = [
    "ASCII RENDERER OFFLINE",
    cropMessage(detail, columns),
  ].filter((line, index, all) => line.length > 0 && (index === 0 || line !== all[0]));
  const startRow = Math.max(0, Math.floor((rows - lines.length) / 2));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const startColumn = Math.max(0, Math.floor((columns - line.length) / 2));
    for (let column = 0; column < line.length && startColumn + column < columns; column += 1) {
      grid[startRow + index]![startColumn + column] = line[column] ?? " ";
    }
  }

  return grid;
}

function cropMessage(message: string, width: number): string {
  const cleaned = message.replace(/\s+/g, " ").trim().toUpperCase();
  if (width <= 0) {
    return "";
  }
  if (cleaned.length <= width) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, width - 1))}…`;
}
