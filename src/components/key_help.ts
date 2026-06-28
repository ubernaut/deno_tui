// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed } from "../signals/mod.ts";
import { formatKeyBinding, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import { Text } from "./text.ts";

export interface KeyHelpOptions extends ComponentOptions {
  bindings: readonly KeyBinding[] | KeymapRegistry;
  group?: string;
}

export function renderKeyHelp(bindings: readonly KeyBinding[], width: number): string {
  return bindings.map(formatKeyBinding).join("  ").slice(0, Math.max(0, width));
}

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
