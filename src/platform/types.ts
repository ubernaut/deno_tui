// Copyright 2023 Im-Beast. MIT license.
import type { EventEmitter } from "../event_emitter.ts";
import type { Signal } from "../signals/mod.ts";
import type { ConsoleSize } from "../types.ts";
import type {
  KeyPressEvent,
  MousePressEvent,
  MouseScrollEvent,
  PasteEvent,
  TerminalFocusEvent,
} from "../input_reader/types.ts";

export interface Disposable {
  dispose(): void;
}

export interface LifecycleController {
  start(): void;
  stop(): void;
  inspect(): LifecycleInspection;
}

export interface LifecycleInspection {
  running: boolean;
  kind: string;
}

export interface PlatformInputEvents {
  keyPress: KeyPressEvent;
  mousePress: MousePressEvent;
  mouseScroll: MouseScrollEvent;
  paste: PasteEvent;
  terminalFocus: TerminalFocusEvent;
}

export type PlatformInputEmitter = EventEmitter<{
  keyPress: { args: [KeyPressEvent] };
  mousePress: { args: [MousePressEvent] };
  mouseScroll: { args: [MouseScrollEvent] };
  paste: { args: [PasteEvent] };
  terminalFocus: { args: [TerminalFocusEvent] };
}>;

export interface InputSource extends Disposable {
  attach(emitter: PlatformInputEmitter): void;
  detach(): void;
  inspect(): InputSourceInspection;
}

export interface InputSourceInspection {
  attached: boolean;
  kind: string;
}

export interface TuiPlatform {
  readonly kind: "terminal" | "browser";
  readonly size: Signal<ConsoleSize>;
  readonly input: InputSource;
  readonly lifecycle: LifecycleController;
  now(): number;
  scheduleFrame(callback: () => void): Disposable;
}

export class NoopLifecycleController implements LifecycleController {
  #running = false;

  constructor(private readonly kind = "noop") {}

  start(): void {
    this.#running = true;
  }

  stop(): void {
    this.#running = false;
  }

  inspect(): LifecycleInspection {
    return { running: this.#running, kind: this.kind };
  }
}

export class NoopInputSource implements InputSource {
  #attached = false;

  constructor(private readonly kind = "noop") {}

  attach(_emitter: PlatformInputEmitter): void {
    this.#attached = true;
  }

  detach(): void {
    this.#attached = false;
  }

  dispose(): void {
    this.detach();
  }

  inspect(): InputSourceInspection {
    return { attached: this.#attached, kind: this.kind };
  }
}
