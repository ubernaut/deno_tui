// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export type ToastLevel = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: string;
  message: string;
  level?: ToastLevel;
}

export interface ToastStackOptions extends ComponentOptions {
  messages: ToastMessage[] | Signal<ToastMessage[]>;
}

export function renderToast(message: ToastMessage): string {
  const level = (message.level ?? "info").toUpperCase();
  return `[${level}] ${message.message}`;
}

export class ToastStack extends Component {
  messages: Signal<ToastMessage[]>;

  constructor(options: ToastStackOptions) {
    super(options);
    this.messages = signalify(options.messages, { deepObserve: true });
  }

  override draw(): void {
    super.draw();

    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const text = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => {
          const message = this.messages.value[index];
          return message ? renderToast(message) : "";
        }),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => ({
          column: this.rectangle.value.column,
          row: this.rectangle.value.row + index,
          width: this.rectangle.value.width,
        })),
        visible: this.visible,
      });
      text.subComponentOf = this;
      this.subComponents[`toast-${index}`] = text;
    });
  }
}
