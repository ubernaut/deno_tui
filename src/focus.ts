// Copyright 2023 Im-Beast. MIT license.
import type { Component } from "./component.ts";
import { DisposableStack } from "./app/disposables.ts";
import type { KeyPressEvent } from "./input_reader/types.ts";

/** Public interface describing a focusable. */
export interface Focusable {
  state: Component["state"];
}

/** Serializable inspection snapshot for focus Manager. */
export interface FocusManagerInspection {
  count: number;
  index: number;
  hasFocus: boolean;
}

/** Public class implementing a focus Manager. */
export class FocusManager {
  readonly items: Focusable[] = [];
  index = -1;

  register(component: Focusable): () => void {
    if (this.items.includes(component)) {
      return () => undefined;
    }
    this.items.push(component);
    return () => this.unregister(component);
  }

  registerAll(components: Iterable<Focusable>): () => void {
    const stack = new DisposableStack();
    for (const component of components) {
      stack.defer(this.register(component));
    }

    return stack.dispose;
  }

  unregister(component: Focusable): void {
    const index = this.items.indexOf(component);
    if (index < 0) return;
    const wasCurrent = index === this.index;
    this.items.splice(index, 1);
    component.state.value = "base";

    if (this.items.length === 0) {
      this.index = -1;
    } else if (wasCurrent) {
      this.index = Math.min(index, this.items.length - 1);
    } else if (index < this.index) {
      this.index -= 1;
    } else if (this.index >= this.items.length) {
      this.index = this.items.length - 1;
    }
    this.applyFocus();
  }

  clear(): void {
    for (const item of this.items) {
      item.state.value = "base";
    }
    this.items.length = 0;
    this.index = -1;
  }

  current(): Focusable | undefined {
    return this.index < 0 ? undefined : this.items[this.index];
  }

  focus(component: Focusable): void {
    const index = this.items.indexOf(component);
    if (index < 0) {
      this.register(component);
      this.index = this.items.length - 1;
    } else {
      this.index = index;
    }
    this.applyFocus();
  }

  next(): Focusable | undefined {
    if (this.items.length === 0) return undefined;
    this.index = (this.index + 1 + this.items.length) % this.items.length;
    this.applyFocus();
    return this.current();
  }

  previous(): Focusable | undefined {
    if (this.items.length === 0) return undefined;
    this.index = (this.index - 1 + this.items.length) % this.items.length;
    this.applyFocus();
    return this.current();
  }

  inspect(): FocusManagerInspection {
    return {
      count: this.items.length,
      index: this.index,
      hasFocus: this.current() !== undefined,
    };
  }

  private applyFocus(): void {
    for (let itemIndex = 0; itemIndex < this.items.length; itemIndex += 1) {
      const item = this.items[itemIndex]!;
      item.state.value = itemIndex === this.index ? "focused" : "base";
    }
  }
}

/** Public interface describing a focus Navigation Target. */
export interface FocusNavigationTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

/** Options for configuring focus Navigation. */
export interface FocusNavigationOptions {
  key?: KeyPressEvent["key"];
  reverseWithShift?: boolean;
  items?: readonly Focusable[];
}

/** Binds focus Navigation behavior and returns a disposer when applicable. */
export function bindFocusNavigation(
  target: FocusNavigationTarget,
  manager: FocusManager,
  options: FocusNavigationOptions = {},
): () => void {
  for (const item of options.items ?? []) {
    manager.register(item);
  }

  const key = options.key ?? "tab";
  const reverseWithShift = options.reverseWithShift ?? true;
  return target.on("keyPress", (event) => {
    if (event.ctrl || event.meta || event.key !== key) return;
    if (reverseWithShift && event.shift) {
      manager.previous();
    } else {
      manager.next();
    }
  });
}

/** Public class implementing a focus Scope. */
export class FocusScope {
  private previous?: Focusable;
  private previousItems: Focusable[] = [];
  private previousIndex = -1;

  constructor(
    readonly manager: FocusManager,
    readonly items: readonly Focusable[],
  ) {}

  enter(initialIndex = 0): Focusable | undefined {
    this.previous = this.manager.current();
    this.previousItems = new Array<Focusable>(this.manager.items.length);
    for (let index = 0; index < this.manager.items.length; index += 1) {
      this.previousItems[index] = this.manager.items[index]!;
    }
    this.previousIndex = this.manager.index;
    for (const item of this.previousItems) {
      item.state.value = "base";
    }
    this.manager.items.splice(0, this.manager.items.length, ...this.items);
    this.manager.index = -1;

    const item = this.items[Math.max(0, Math.min(this.items.length - 1, initialIndex))];
    if (item) {
      this.manager.focus(item);
    }
    return item;
  }

  exit(): void {
    for (const item of this.items) {
      item.state.value = "base";
    }
    this.manager.items.splice(0, this.manager.items.length, ...this.previousItems);
    this.manager.index = this.previousIndex;

    if (this.previous) {
      this.manager.focus(this.previous);
    }
  }
}
