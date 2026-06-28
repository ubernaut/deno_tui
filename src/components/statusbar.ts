// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

export interface StatusBarOptions extends ComponentOptions {
  left: string | Signal<string>;
  right?: string | Signal<string>;
}

export function renderStatusBar(left: string, right: string, width: number): string {
  const safeWidth = Math.max(0, width);
  const leftText = left.slice(0, safeWidth);
  const rightText = right.slice(0, Math.max(0, safeWidth - leftText.length));
  const gap = Math.max(1, safeWidth - leftText.length - rightText.length);
  return `${leftText}${" ".repeat(gap)}${rightText}`.slice(0, safeWidth);
}

export class StatusBar extends Component {
  constructor(private readonly options: StatusBarOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();

    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => {
        const left = typeof this.options.left === "string" ? this.options.left : this.options.left.value;
        const right = this.options.right === undefined
          ? ""
          : typeof this.options.right === "string"
          ? this.options.right
          : this.options.right.value;
        return renderStatusBar(left, right, this.rectangle.value.width);
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
