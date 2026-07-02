// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { drawTextRows } from "./text_rows.ts";

/** Options for configuring empty State. */
export interface EmptyStateOptions extends ComponentOptions {
  title: string | Signal<string>;
  message?: string | Signal<string>;
  action?: string | Signal<string>;
  icon?: string | Signal<string>;
  center?: boolean | Signal<boolean>;
}

/** Public interface describing an empty State Content. */
export interface EmptyStateContent {
  title: string;
  message?: string;
  action?: string;
  icon?: string;
}

/** Renders empty State into deterministic text rows. */
export function renderEmptyState(
  content: EmptyStateContent,
  width: number,
  height: number,
  center = true,
): string[] {
  const safeHeight = Math.max(0, Math.floor(height));
  if (safeHeight === 0) return [];
  const visible: string[] = [];
  appendEmptyStateLine(visible, content.icon ?? "", width, safeHeight);
  appendEmptyStateLine(visible, content.title, width, safeHeight);
  appendEmptyStateLine(visible, content.message ?? "", width, safeHeight);
  appendEmptyStateLine(visible, content.action ?? "", width, safeHeight);
  if (!center || visible.length >= safeHeight) return visible;

  const topPadding = Math.floor((safeHeight - visible.length) / 2);
  const centered = new Array<string>(Math.min(safeHeight, topPadding + visible.length));
  for (let index = 0; index < topPadding; index++) {
    centered[index] = "";
  }
  for (let index = 0; index < visible.length && topPadding + index < safeHeight; index++) {
    centered[topPadding + index] = visible[index]!;
  }
  return centered;
}

function appendEmptyStateLine(target: string[], line: string, width: number, maxRows: number): void {
  if (target.length >= maxRows || line.length === 0) return;
  target.push(fitEmptyStateLine(line, width));
}

function fitEmptyStateLine(line: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (line.length <= safeWidth) return line;
  if (safeWidth === 0) return "";
  if (safeWidth === 1) return "…";
  return `${line.slice(0, safeWidth - 1)}…`;
}

/** Public class implementing an empty State. */
export class EmptyState extends Component {
  readonly title: Signal<string>;
  readonly message: Signal<string>;
  readonly action: Signal<string>;
  readonly icon: Signal<string>;
  readonly center: Signal<boolean>;
  readonly #rows: Computed<string[]>;

  constructor(options: EmptyStateOptions) {
    super(options);
    this.title = signalify(options.title);
    this.message = signalify(options.message ?? "");
    this.action = signalify(options.action ?? "");
    this.icon = signalify(options.icon ?? "");
    this.center = signalify(options.center ?? true);
    this.#rows = new Computed(() =>
      renderEmptyState(
        {
          title: this.title.value,
          message: this.message.value,
          action: this.action.value,
          icon: this.icon.value,
        },
        this.rectangle.value.width,
        this.rectangle.value.height,
        this.center.value,
      )
    );
    this.on("destroy", () => this.#rows.dispose());
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#rows);
  }
}
