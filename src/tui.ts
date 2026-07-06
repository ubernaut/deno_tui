// Copyright 2023 Im-Beast. MIT license.
import { BoxObject, Canvas } from "./canvas/mod.ts";
import { Component } from "./component.ts";
import { EmitterEvent, EventEmitter } from "./event_emitter.ts";
import { InputEventRecord } from "./input_reader/mod.ts";
import { Computed, Signal } from "./signals/mod.ts";
import { Style } from "./theme.ts";
import { Rectangle, Stdin, Stdout } from "./types.ts";
import {
  DISABLE_BRACKETED_PASTE,
  DISABLE_FOCUS_EVENTS,
  DISABLE_MOUSE,
  ENABLE_BRACKETED_PASTE,
  ENABLE_FOCUS_EVENTS,
  ENABLE_MOUSE,
  HIDE_CURSOR,
  SHOW_CURSOR,
  USE_PRIMARY_BUFFER,
  USE_SECONDARY_BUFFER,
} from "./utils/ansi_codes.ts";
import { RenderLoop } from "./runtime/render_loop.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let canRunSttyCached: boolean | undefined;

/** Options for configuring tui. */
export interface TuiOptions {
  style?: Style;
  stdin?: Stdin;
  stdout?: Stdout;
  canvas?: Canvas;
  refreshRate?: number;
  renderLoop?: RenderLoop;
  enableMouse?: boolean;
  enableBracketedPaste?: boolean;
  enableFocusEvents?: boolean;
}

/**
 * Root element of Tui app.
 *
 * This keeps elements running and manages Components as children.
 *
 * @example
 * ```ts
 * const tui = new Tui({
 *   style: crayon.bgBlack,
 *   refreshRate: 1000 / 60,
 * });
 *
 * tui.dispatch();
 * tui.run();
 * ```
 */
export class Tui extends EventEmitter<
  {
    destroy: EmitterEvent<[]>;
  } & InputEventRecord
> {
  stdin: Stdin;
  stdout: Stdout;
  canvas: Canvas;
  rectangle: Signal<Rectangle>;
  style?: Style;
  children: Component[];
  components: Set<Component>;
  drawnObjects: { background?: BoxObject };
  refreshRate: number;
  renderLoop: RenderLoop;
  enableMouse: boolean;
  enableBracketedPaste: boolean;
  enableFocusEvents: boolean;
  private readonly updateCanvasSize: (options?: { verifyWithStty?: boolean }) => void;
  private readonly sigwinchResizeHandler?: () => void;
  private readonly resizePollTimer?: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(options: TuiOptions) {
    super();
    this.stdin = options.stdin ?? Deno.stdin;
    this.stdout = options.stdout ?? Deno.stdout;
    this.refreshRate = options.refreshRate ?? 1000 / 60;
    this.enableMouse = options.enableMouse ?? false;
    this.canvas = options.canvas ?? new Canvas({
      stdout: this.stdout,
      size: terminalSize(),
    });
    this.updateCanvasSize = (updateOptions = {}) => {
      if (this.destroyed) return;
      const { canvas } = this;
      const { columns, rows } = terminalSize(updateOptions);

      const size = canvas.size.peek();

      if (size.columns !== columns || size.rows !== rows) {
        canvas.size.value = { columns, rows };
      }
    };
    this.renderLoop = options.renderLoop ?? new RenderLoop({
      intervalMs: this.refreshRate,
      tick: () => {
        this.updateCanvasSize();
        this.canvas.render();
      },
    });
    this.enableBracketedPaste = options.enableBracketedPaste ?? false;
    this.enableFocusEvents = options.enableFocusEvents ?? false;

    this.style = options.style;

    this.drawnObjects = {};
    this.components = new Set();
    this.children = [];

    const tuiRectangle = { column: 0, row: 0, width: 0, height: 0 };
    this.rectangle = new Computed(() => {
      const { columns, rows } = this.canvas.size.value;
      tuiRectangle.width = columns;
      tuiRectangle.height = rows;
      return tuiRectangle;
    });

    this.updateCanvasSize();

    if (Deno.build.os === "windows") {
      this.resizePollTimer = setInterval(this.updateCanvasSize, this.refreshRate);
    } else {
      this.sigwinchResizeHandler = () => this.updateCanvasSize({ verifyWithStty: true });
      Deno.addSignalListener("SIGWINCH", this.sigwinchResizeHandler);
      this.resizePollTimer = setInterval(
        () => this.updateCanvasSize({ verifyWithStty: true }),
        Math.max(1_000, this.refreshRate * 10),
      );
    }
  }

  addChild(child: Component): void {
    this.children.push(child);
    this.components.add(child);

    if (!child.visible.peek()) return;
    child.draw();
  }

  run(): void {
    const { style, canvas, stdout, drawnObjects } = this;

    if (style) {
      const { background } = drawnObjects;

      background?.erase();

      const box = new BoxObject({
        canvas,
        rectangle: this.rectangle,
        style,
        zIndex: -1,
      });

      drawnObjects.background = box;
      box.draw();
    }

    stdout.write(textEncoder.encode(
      USE_SECONDARY_BUFFER + HIDE_CURSOR +
        (this.enableBracketedPaste ? ENABLE_BRACKETED_PASTE : "") +
        (this.enableFocusEvents ? ENABLE_FOCUS_EVENTS : "") +
        (this.enableMouse ? ENABLE_MOUSE : ""),
    ));

    this.renderLoop.start();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.off();

    this.renderLoop.stop();
    if (this.resizePollTimer !== undefined) clearInterval(this.resizePollTimer);
    if (Deno.build.os !== "windows" && this.sigwinchResizeHandler) {
      try {
        Deno.removeSignalListener("SIGWINCH", this.sigwinchResizeHandler);
      } catch { /**/ }
    }

    try {
      this.stdin.setRaw(false);
    } catch { /**/ }

    this.stdout.write(textEncoder.encode(
      (this.enableMouse ? DISABLE_MOUSE : "") +
        (this.enableFocusEvents ? DISABLE_FOCUS_EVENTS : "") +
        (this.enableBracketedPaste ? DISABLE_BRACKETED_PASTE : "") +
        USE_PRIMARY_BUFFER + SHOW_CURSOR,
    ));

    for (const component of this.components) {
      component.destroy();
    }
  }

  dispatch(): void {
    const destroyDispatcher = () => {
      this.emit("destroy");
    };

    if (Deno.build.os === "windows") {
      Deno.addSignalListener("SIGBREAK", destroyDispatcher);

      this.on("keyPress", ({ key, ctrl }) => {
        if (ctrl && key === "c") destroyDispatcher();
      });
    } else {
      Deno.addSignalListener("SIGTERM", destroyDispatcher);
    }

    Deno.addSignalListener("SIGINT", destroyDispatcher);

    this.on("destroy", async () => {
      this.destroy();
      await Promise.resolve();
      Deno.exit(0);
    });
  }
}

function terminalSize(options: { verifyWithStty?: boolean } = {}): { columns: number; rows: number } {
  try {
    const denoSize = Deno.consoleSize();
    return options.verifyWithStty ? sttyTerminalSize() ?? denoSize : denoSize;
  } catch (error) {
    const sttySize = options.verifyWithStty ? sttyTerminalSize() : undefined;
    if (sttySize) return sttySize;
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Tui requires an interactive terminal. Run this command from a TTY or use a report/web task instead. (${detail})`,
    );
  }
}

function sttyTerminalSize(): { columns: number; rows: number } | undefined {
  if (Deno.build.os === "windows") return undefined;
  try {
    if (!canRunStty()) return undefined;
    const output = new Deno.Command("stty", {
      args: ["size"],
      stdin: "inherit",
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    if (!output.success) return undefined;
    const text = textDecoder.decode(output.stdout).trim();
    const [rowsText, columnsText] = text.split(/\s+/, 2);
    const rows = Number.parseInt(rowsText ?? "", 10);
    const columns = Number.parseInt(columnsText ?? "", 10);
    if (!Number.isFinite(rows) || !Number.isFinite(columns) || rows <= 0 || columns <= 0) return undefined;
    return { columns, rows };
  } catch {
    return undefined;
  }
}

function canRunStty(): boolean {
  if (canRunSttyCached !== undefined) return canRunSttyCached;
  try {
    canRunSttyCached = Deno.permissions.querySync({ name: "run", command: "stty" }).state === "granted";
    return canRunSttyCached;
  } catch {
    canRunSttyCached = false;
    return false;
  }
}
