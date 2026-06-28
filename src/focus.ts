// Copyright 2023 Im-Beast. MIT license.
import type { Component } from "./component.ts";

export class FocusManager {
  readonly items: Component[] = [];
  index = -1;

  register(component: Component): void {
    if (!this.items.includes(component)) {
      this.items.push(component);
    }
  }

  unregister(component: Component): void {
    const index = this.items.indexOf(component);
    if (index < 0) return;
    this.items.splice(index, 1);
    if (this.index >= this.items.length) {
      this.index = this.items.length - 1;
    }
  }

  current(): Component | undefined {
    return this.index < 0 ? undefined : this.items[this.index];
  }

  focus(component: Component): void {
    const index = this.items.indexOf(component);
    if (index < 0) {
      this.register(component);
      this.index = this.items.length - 1;
    } else {
      this.index = index;
    }
    this.applyFocus();
  }

  next(): Component | undefined {
    if (this.items.length === 0) return undefined;
    this.index = (this.index + 1 + this.items.length) % this.items.length;
    this.applyFocus();
    return this.current();
  }

  previous(): Component | undefined {
    if (this.items.length === 0) return undefined;
    this.index = (this.index - 1 + this.items.length) % this.items.length;
    this.applyFocus();
    return this.current();
  }

  private applyFocus(): void {
    this.items.forEach((item, itemIndex) => {
      item.state.value = itemIndex === this.index ? "focused" : "base";
    });
  }
}
