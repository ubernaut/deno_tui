// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { drawTextRows } from "./text_rows.ts";

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
    this.messages.value = copyLatestToastMessages(this.messages.peek(), normalizedLimit);
  }

  clear(): void {
    this.messages.value = [];
  }

  inspect(): ToastStackInspection {
    const sourceMessages = this.messages.peek();
    const messages = new Array<ToastMessage>(sourceMessages.length);
    for (let index = 0; index < sourceMessages.length; index += 1) {
      messages[index] = { ...sourceMessages[index]! };
    }
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

function copyLatestToastMessages(messages: readonly ToastMessage[], limit: number): ToastMessage[] {
  const normalizedLimit = normalizedToastLimit(limit);
  if (normalizedLimit === 0 || messages.length === 0) return [];
  const count = Math.min(normalizedLimit, messages.length);
  const start = messages.length - count;
  const output = new Array<ToastMessage>(count);
  for (let index = 0; index < count; index += 1) {
    output[index] = messages[start + index]!;
  }
  return output;
}

/** Public class implementing a toast Stack. */
export class ToastStack extends Component {
  messages: Signal<ToastMessage[]>;
  readonly #rows: Computed<string[]>;

  constructor(options: ToastStackOptions) {
    super(options);
    this.messages = signalify(options.messages, { deepObserve: true });
    this.#rows = new Computed(() => {
      const height = this.rectangle.value.height;
      const lines = new Array<string>(height);
      for (let index = 0; index < height; index++) {
        const message = this.messages.value[index];
        lines[index] = message ? renderToast(message) : "";
      }
      return lines;
    });
    this.on("destroy", () => this.#rows.dispose());
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#rows, { keyPrefix: "toast" });
  }
}

function normalizedToastLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
}
