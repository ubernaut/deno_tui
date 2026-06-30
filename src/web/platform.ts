/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { ConsoleSize } from "../types.ts";
import {
  type Disposable,
  type InputSource,
  type InputSourceInspection,
  type LifecycleController,
  NoopLifecycleController,
  type PlatformInputEmitter,
  type TuiPlatform,
} from "../platform/mod.ts";
import type { Key, MousePressEvent } from "../input_reader/types.ts";

export interface BrowserPlatformOptions {
  root: HTMLElement;
  columns?: number;
  rows?: number;
  cellWidth?: number;
  cellHeight?: number;
  input?: InputSource;
  lifecycle?: LifecycleController;
  scheduler?: BrowserFrameScheduler;
}

export interface BrowserFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
  now(): number;
}

export class BrowserPlatform implements TuiPlatform {
  readonly kind = "browser" as const;
  readonly size: Signal<ConsoleSize>;
  readonly input: InputSource;
  readonly lifecycle: LifecycleController;
  readonly #scheduler: BrowserFrameScheduler;
  readonly #resizeObserver?: ResizeObserver;

  constructor(options: BrowserPlatformOptions) {
    const cellWidth = options.cellWidth ?? 10;
    const cellHeight = options.cellHeight ?? 20;
    this.size = new Signal(
      options.columns && options.rows
        ? { columns: options.columns, rows: options.rows }
        : sizeFromElement(options.root, cellWidth, cellHeight),
      { deepObserve: true },
    );
    this.input = options.input ?? new BrowserInputSource(options.root, { cellWidth, cellHeight });
    this.lifecycle = options.lifecycle ?? new NoopLifecycleController("browser");
    this.#scheduler = options.scheduler ?? defaultBrowserFrameScheduler();

    if ("ResizeObserver" in globalThis) {
      this.#resizeObserver = new ResizeObserver(() => {
        const next = sizeFromElement(options.root, cellWidth, cellHeight);
        const current = this.size.peek();
        if (next.columns !== current.columns || next.rows !== current.rows) {
          current.columns = next.columns;
          current.rows = next.rows;
        }
      });
      this.#resizeObserver.observe(options.root);
    }
  }

  now(): number {
    return this.#scheduler.now();
  }

  scheduleFrame(callback: () => void): Disposable {
    const handle = this.#scheduler.request(() => callback());
    return { dispose: () => this.#scheduler.cancel(handle) };
  }

  dispose(): void {
    this.#resizeObserver?.disconnect();
    this.input.dispose();
    this.lifecycle.stop();
  }
}

export class BrowserInputSource implements InputSource {
  readonly #target: HTMLElement;
  readonly #cellWidth: number;
  readonly #cellHeight: number;
  #emitter?: PlatformInputEmitter;
  #attached = false;
  #removeListeners: Array<() => void> = [];

  constructor(target: HTMLElement, options: { cellWidth?: number; cellHeight?: number } = {}) {
    this.#target = target;
    this.#cellWidth = Math.max(1, options.cellWidth ?? 10);
    this.#cellHeight = Math.max(1, options.cellHeight ?? 20);
  }

  attach(emitter: PlatformInputEmitter): void {
    this.detach();
    this.#emitter = emitter;
    this.#target.tabIndex = this.#target.tabIndex < 0 ? 0 : this.#target.tabIndex;
    this.#removeListeners = [
      addListener(this.#target, "keydown", (event) => this.#handleKey(event as KeyboardEvent)),
      addListener(this.#target, "pointerdown", (event) => this.#handlePointer(event as PointerEvent, false)),
      addListener(this.#target, "pointermove", (event) => this.#handlePointerMove(event as PointerEvent)),
      addListener(this.#target, "pointerup", (event) => this.#handlePointer(event as PointerEvent, true)),
      addListener(this.#target, "pointercancel", (event) => this.#handlePointer(event as PointerEvent, true)),
      addListener(this.#target, "wheel", (event) => this.#handleWheel(event as WheelEvent)),
      addListener(this.#target, "paste", (event) => this.#handlePaste(event as ClipboardEvent)),
      addListener(this.#target, "focus", () => this.#handleFocus(true)),
      addListener(this.#target, "blur", () => this.#handleFocus(false)),
    ];
    this.#attached = true;
  }

  detach(): void {
    for (const remove of this.#removeListeners) remove();
    this.#removeListeners = [];
    this.#emitter = undefined;
    this.#attached = false;
  }

  dispose(): void {
    this.detach();
  }

  inspect(): InputSourceInspection {
    return { attached: this.#attached, kind: "browser" };
  }

  #handleKey(event: KeyboardEvent): void {
    const key = browserKey(event);
    if (!key) return;
    this.#emitter?.emit("keyPress", {
      key,
      meta: event.metaKey || event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      buffer: new TextEncoder().encode(event.key.length === 1 ? event.key : event.code),
    });
    event.preventDefault();
  }

  #handlePointer(event: PointerEvent, release: boolean): void {
    if (!release) {
      this.#target.focus({ preventScroll: true });
      this.#target.setPointerCapture?.(event.pointerId);
    } else if (this.#target.hasPointerCapture?.(event.pointerId)) {
      this.#target.releasePointerCapture?.(event.pointerId);
    }
    const position = this.#cellPosition(event);
    this.#emitter?.emit("mousePress", {
      key: "mouse",
      x: position.x,
      y: position.y,
      movementX: event.movementX,
      movementY: event.movementY,
      meta: event.metaKey || event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      buffer: new Uint8Array(),
      drag: !release && event.buttons !== 0,
      release,
      button: release ? undefined : browserButton(event.button),
    });
    event.preventDefault();
  }

  #handlePointerMove(event: PointerEvent): void {
    if (event.buttons === 0) return;
    const position = this.#cellPosition(event);
    this.#emitter?.emit("mousePress", {
      key: "mouse",
      x: position.x,
      y: position.y,
      movementX: event.movementX,
      movementY: event.movementY,
      meta: event.metaKey || event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      buffer: new Uint8Array(),
      drag: true,
      release: false,
      button: browserButton(event.button),
    });
    event.preventDefault();
  }

  #handleWheel(event: WheelEvent): void {
    const position = this.#cellPosition(event);
    this.#emitter?.emit("mouseScroll", {
      key: "mouse",
      x: position.x,
      y: position.y,
      movementX: 0,
      movementY: event.deltaY,
      meta: event.metaKey || event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      buffer: new Uint8Array(),
      drag: false,
      scroll: event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0,
    });
    event.preventDefault();
  }

  #handlePaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData("text") ?? "";
    this.#emitter?.emit("paste", {
      key: "paste",
      text,
      buffer: new TextEncoder().encode(text),
    });
    event.preventDefault();
  }

  #handleFocus(focused: boolean): void {
    this.#emitter?.emit("terminalFocus", {
      key: "focus",
      focused,
      buffer: new Uint8Array(),
    });
  }

  #cellPosition(event: MouseEvent): { x: number; y: number } {
    const rect = this.#target.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor((event.clientX - rect.left) / this.#cellWidth)),
      y: Math.max(0, Math.floor((event.clientY - rect.top) / this.#cellHeight)),
    };
  }
}

export function createBrowserPlatform(options: BrowserPlatformOptions): BrowserPlatform {
  return new BrowserPlatform(options);
}

function sizeFromElement(root: HTMLElement, cellWidth: number, cellHeight: number): ConsoleSize {
  const rect = root.getBoundingClientRect();
  return {
    columns: Math.max(1, Math.floor(rect.width / cellWidth)),
    rows: Math.max(1, Math.floor(rect.height / cellHeight)),
  };
}

function addListener(target: HTMLElement, type: string, listener: EventListener): () => void {
  target.addEventListener(type, listener);
  return () => target.removeEventListener(type, listener);
}

function browserButton(button: number): MousePressEvent["button"] {
  return button === 0 || button === 1 || button === 2 ? button : 0;
}

function browserKey(event: KeyboardEvent): Key | undefined {
  if (event.key.length === 1) {
    return event.key === " " ? "space" : event.key.toLowerCase() as Key;
  }
  const mapped: Record<string, Key> = {
    Enter: "return",
    Tab: "tab",
    Backspace: "backspace",
    Escape: "escape",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Delete: "delete",
    Insert: "insert",
    PageUp: "pageup",
    PageDown: "pagedown",
    Home: "home",
    End: "end",
  };
  if (event.key in mapped) return mapped[event.key]!;
  if (/^F([1-9]|1[0-2])$/.test(event.key)) return event.key.toLowerCase() as Key;
  return undefined;
}

function defaultBrowserFrameScheduler(): BrowserFrameScheduler {
  const request = globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 1000 / 60) as unknown as number;
  });
  const cancel = globalThis.cancelAnimationFrame ?? ((handle: number) => clearTimeout(handle));
  return {
    request: (callback) => request(callback),
    cancel: (handle) => cancel(handle),
    now: () => performance.now(),
  };
}
