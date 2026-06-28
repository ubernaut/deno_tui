// Copyright 2023 Im-Beast. MIT license.
import type { ComponentState } from "../component.ts";
import type { Focusable, FocusNavigationTarget } from "../focus.ts";
import type { KeyPressEvent, MouseScrollEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";

export interface TestKeyPressOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  buffer?: Uint8Array;
}

export function createTestKeyPress(
  key: KeyPressEvent["key"],
  options: TestKeyPressOptions = {},
): KeyPressEvent {
  return {
    key,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    buffer: options.buffer ?? new Uint8Array(),
  };
}

export function createTestMouseScroll(
  scroll: MouseScrollEvent["scroll"],
  options: Partial<Omit<MouseScrollEvent, "key" | "scroll" | "buffer">> & { buffer?: Uint8Array } = {},
): MouseScrollEvent {
  return {
    key: "mouse",
    scroll,
    x: options.x ?? 0,
    y: options.y ?? 0,
    movementX: options.movementX ?? 0,
    movementY: options.movementY ?? 0,
    meta: options.meta ?? false,
    ctrl: options.ctrl ?? false,
    shift: options.shift ?? false,
    drag: options.drag ?? false,
    buffer: options.buffer ?? new Uint8Array(),
  };
}

export function createTestFocusable(initialState: ComponentState = "base"): Focusable {
  return { state: new Signal<ComponentState>(initialState) };
}

export class TestKeyPressTarget implements FocusNavigationTarget {
  private readonly listeners = new Set<(event: KeyPressEvent) => void | Promise<void>>();

  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void {
    if (type !== "keyPress") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: KeyPressEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  key(key: KeyPressEvent["key"], options: TestKeyPressOptions = {}): void {
    this.emit(createTestKeyPress(key, options));
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}
