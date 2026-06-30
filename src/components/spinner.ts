// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public type alias for a spinner Status. */
export type SpinnerStatus = "idle" | "loading" | "success" | "error";

/** Options for configuring spinner. */
export interface SpinnerOptions extends ComponentOptions {
  label?: string | Signal<string>;
  status?: SpinnerStatus | Signal<SpinnerStatus>;
  frameIndex?: number | Signal<number>;
  frames?: string[] | Signal<string[]>;
  autoAdvance?: boolean;
  intervalMs?: number;
}

/** Built-in dEFAULT SPINNER FRAMES definitions. */
export const DEFAULT_SPINNER_FRAMES = ["|", "/", "-", "\\"];

/** Renders spinner into deterministic text rows. */
export function renderSpinner(
  label = "",
  status: SpinnerStatus = "loading",
  frameIndex = 0,
  frames: readonly string[] = DEFAULT_SPINNER_FRAMES,
  width = Number.POSITIVE_INFINITY,
): string {
  const glyph = spinnerGlyph(status, frameIndex, frames);
  const text = label ? `${glyph} ${label}` : glyph;
  return truncateSpinner(text, width);
}

/** Public helper for spinner Glyph. */
export function spinnerGlyph(
  status: SpinnerStatus,
  frameIndex = 0,
  frames: readonly string[] = DEFAULT_SPINNER_FRAMES,
): string {
  if (status === "success") return "✓";
  if (status === "error") return "!";
  if (status === "idle") return " ";
  if (frames.length === 0) return "";
  return frames[((Math.floor(frameIndex) % frames.length) + frames.length) % frames.length] ?? "";
}

function truncateSpinner(text: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (text.length <= safeWidth) return text;
  if (safeWidth === 0) return "";
  if (safeWidth === 1) return "…";
  return `${text.slice(0, safeWidth - 1)}…`;
}

/** Public class implementing a spinner. */
export class Spinner extends Component {
  readonly label: Signal<string>;
  readonly status: Signal<SpinnerStatus>;
  readonly frameIndex: Signal<number>;
  readonly frames: Signal<string[]>;
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: SpinnerOptions) {
    super(options);
    this.label = signalify(options.label ?? "");
    this.status = signalify(options.status ?? "loading");
    this.frameIndex = signalify(options.frameIndex ?? 0);
    this.frames = signalify(options.frames ?? [...DEFAULT_SPINNER_FRAMES], { deepObserve: true });

    if (options.autoAdvance !== false) {
      this.#timer = setInterval(() => {
        if (this.status.peek() === "loading") {
          this.frameIndex.value += 1;
        }
      }, Math.max(16, Math.floor(options.intervalMs ?? 120)));
      this.on("destroy", () => {
        if (this.#timer) clearInterval(this.#timer);
      });
    }
  }

  override draw(): void {
    super.draw();
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() =>
        renderSpinner(
          this.label.value,
          this.status.value,
          this.frameIndex.value,
          this.frames.value,
          this.rectangle.value.width,
        )
      ),
      overwriteWidth: true,
      multiCodePointSupport: true,
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
