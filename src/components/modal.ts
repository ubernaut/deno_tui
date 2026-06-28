// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed } from "../signals/mod.ts";
import { Box } from "./box.ts";
import { Frame } from "./frame.ts";
import { Text } from "./text.ts";

export interface ModalOptions extends ComponentOptions {
  title?: string;
  body?: string;
}

export class Modal extends Component {
  constructor(private readonly options: ModalOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();

    const box = new Box({
      parent: this,
      theme: this.theme,
      rectangle: this.rectangle,
      zIndex: this.zIndex,
      visible: this.visible,
    });
    const frame = new Frame({
      parent: this,
      theme: this.theme,
      rectangle: this.rectangle,
      zIndex: this.zIndex,
      charMap: "rounded",
      visible: this.visible,
    });
    const title = new Text({
      parent: this,
      theme: this.theme,
      zIndex: new Computed(() => this.zIndex.value + 1),
      text: this.options.title ?? "",
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column + 1,
        row: this.rectangle.value.row - 1,
      })),
      visible: this.visible,
    });
    const body = new Text({
      parent: this,
      theme: this.theme,
      zIndex: new Computed(() => this.zIndex.value + 1),
      text: this.options.body ?? "",
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column + 1,
        row: this.rectangle.value.row + 1,
        width: Math.max(0, this.rectangle.value.width - 2),
      })),
      visible: this.visible,
    });
    box.subComponentOf =
      frame.subComponentOf =
      title.subComponentOf =
      body.subComponentOf =
        this;
    this.subComponents.box = box;
    this.subComponents.frame = frame;
    this.subComponents.title = title;
    this.subComponents.body = body;
  }
}
