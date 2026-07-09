// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed } from "../signals/mod.ts";
import { formatKeyBinding, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import { drawTextChild } from "./text_children.ts";

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
    const prefix = index === 0 ? "" : "  ";
    const nextLength = row.length + prefix.length + segment.length;
    if (nextLength >= limit) return `${row}${prefix}${segment}`.slice(0, limit);
    row += `${prefix}${segment}`;
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

    drawTextChild(
      this,
      new Computed(() => {
        const bindings = "list" in this.options.bindings
          ? this.options.bindings.list(this.options.group)
          : this.options.bindings;
        return renderKeyHelp(bindings, this.rectangle.value.width);
      }),
    );
  }
}
