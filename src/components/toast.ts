// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public type alias for a toast Level. */
export type ToastLevel = "info" | "success" | "warning" | "error";

/** Public interface describing a toast Message. */
export interface ToastMessage {
  id: string;
  message: string;
  level?: ToastLevel;
}

/** Options for configuring toast Stack Controller. */
export interface ToastStackControllerOptions {
  messages?: ToastMessage[] | Signal<ToastMessage[]>;
  limit?: number | Signal<number>;
  idFactory?: () => string;
}

/** Serializable inspection snapshot for toast Stack. */
export interface ToastStackInspection {
  messages: ToastMessage[];
  count: number;
  limit: number;
  empty: boolean;
}

/** Options for configuring toast Stack. */
export interface ToastStackOptions extends ComponentOptions {
  messages: ToastMessage[] | Signal<ToastMessage[]>;
}

/** Renders toast into deterministic text rows. */
export function renderToast(message: ToastMessage): string {
  const level = (message.level ?? "info").toUpperCase();
  return `[${level}] ${message.message}`;
}

/** State controller for toast Stack behavior. */
export class ToastStackController {
  readonly messages: Signal<ToastMessage[]>;
  readonly limit: Signal<number>;
  readonly #idFactory: () => string;

  constructor(options: ToastStackControllerOptions = {}) {
    this.messages = signalify(options.messages ?? [], { deepObserve: true });
    this.limit = signalify(options.limit ?? 4);
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#trim();
  }

  show(message: string, level: ToastLevel = "info", id = this.#idFactory()): ToastMessage {
    return this.push({ id, level, message });
  }

  push(message: ToastMessage): ToastMessage {
    this.messages.value.push({ ...message });
    this.#trim();
    return message;
  }

  dismiss(id: string): boolean {
    const index = this.messages.value.findIndex((message) => message.id === id);
    if (index < 0) return false;
    this.messages.value.splice(index, 1);
    return true;
  }

  dismissLatest(): ToastMessage | undefined {
    return this.messages.value.pop();
  }

  setLimit(limit: number): void {
    const normalizedLimit = normalizedToastLimit(limit);
    this.limit.value = normalizedLimit;
    this.messages.value = normalizedLimit === 0 ? [] : this.messages.peek().slice(-normalizedLimit);
  }

  clear(): void {
    this.messages.value = [];
  }

  inspect(): ToastStackInspection {
    const messages = this.messages.peek().map((message) => ({ ...message }));
    const limit = normalizedToastLimit(this.limit.peek());
    return {
      messages,
      count: messages.length,
      limit,
      empty: messages.length === 0,
    };
  }

  dispose(): void {
    this.messages.dispose();
    this.limit.dispose();
  }

  #trim(): void {
    const limit = normalizedToastLimit(this.limit.peek());
    while (this.messages.value.length > limit) {
      this.messages.value.shift();
    }
  }
}

/** Public class implementing a toast Stack. */
export class ToastStack extends Component {
  messages: Signal<ToastMessage[]>;

  constructor(options: ToastStackOptions) {
    super(options);
    this.messages = signalify(options.messages, { deepObserve: true });
  }

  override draw(): void {
    super.draw();

    const height = this.rectangle.peek().height;
    for (let index = 0; index < height; index++) {
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
    }
  }
}

function normalizedToastLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
}
