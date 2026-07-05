// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

/** Options for configuring status Bar. */
export interface StatusBarOptions extends ComponentOptions {
  left: string | Signal<string>;
  right?: string | Signal<string>;
  priority?: StatusBarPriority;
}

/** Which side keeps more text when both status segments cannot fit. */
export type StatusBarPriority = "left" | "right";

/** Renders status Bar into deterministic text rows. */
export function renderStatusBar(
  left: string,
  right: string,
  width: number,
  priority: StatusBarPriority = "left",
): string {
  const safeWidth = Math.max(0, width);
  if (priority === "right") return renderRightPriorityStatusBar(left, right, safeWidth);
  let leftText = left.slice(0, safeWidth);
  const remaining = safeWidth - leftText.length;
  if (remaining <= 0) return leftText;

  const minGap = leftText.length > 0 && right.length > 0 ? Math.min(2, safeWidth) : 0;
  let rightText = right.slice(0, remaining);
  let gap = Math.max(0, safeWidth - leftText.length - rightText.length);
  if (rightText.length > 0 && gap < minGap) {
    const trim = Math.min(leftText.length, minGap - gap);
    leftText = leftText.slice(0, leftText.length - trim);
    rightText = right.slice(0, Math.max(0, safeWidth - leftText.length - minGap));
    gap = rightText.length > 0 ? Math.max(minGap, safeWidth - leftText.length - rightText.length) : 0;
  }
  return `${leftText}${" ".repeat(gap)}${rightText}`;
}

function renderRightPriorityStatusBar(left: string, right: string, width: number): string {
  const rightText = right.slice(0, width);
  if (rightText.length >= width) return rightText;
  const minGap = left.length > 0 && rightText.length > 0 ? Math.min(2, width) : 0;
  const leftWidth = Math.max(0, width - rightText.length - minGap);
  const leftText = left.slice(0, leftWidth);
  const gap = rightText.length > 0 ? Math.max(0, width - leftText.length - rightText.length) : 0;
  return `${leftText}${" ".repeat(gap)}${rightText}`;
}

/** Public class implementing a status Bar. */
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
        return renderStatusBar(left, right, this.rectangle.value.width, this.options.priority);
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
