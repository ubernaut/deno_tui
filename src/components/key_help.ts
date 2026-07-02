// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed } from "../signals/mod.ts";
import { formatKeyBinding, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import { Text } from "./text.ts";

/** Options for configuring key Help. */
export interface KeyHelpOptions extends ComponentOptions {
  bindings: readonly KeyBinding[] | KeymapRegistry;
  group?: string;
}

/** Renders key Help into deterministic text rows. */
export function renderKeyHelp(bindings: readonly KeyBinding[], width: number): string {
  const limit = Math.max(0, width);
  if (limit === 0 || bindings.length === 0) return "";

  let row = "";
  for (let index = 0; index < bindings.length; index += 1) {
    const segment = formatKeyBinding(bindings[index]!);
    const next = index === 0 ? segment : `${row}  ${segment}`;
    if (next.length >= limit) return next.slice(0, limit);
    row = next;
  }
  return row;
}

/** Public class implementing a key Help. */
export class KeyHelp extends Component {
  constructor(private readonly options: KeyHelpOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();

    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => {
        const bindings = "list" in this.options.bindings
          ? this.options.bindings.list(this.options.group)
          : this.options.bindings;
        return renderKeyHelp(bindings, this.rectangle.value.width);
      }),
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row,
        width: this.rectangle.value.width,
      })),
      visible: this.visible,
    });
    text.subComponentOf = this;
    this.subComponents.text = text;
  }
}
