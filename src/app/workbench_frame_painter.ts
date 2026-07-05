// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import {
  projectWorkbenchButton,
  type WorkbenchButtonTheme,
  type WorkbenchButtonTone,
} from "./workbench_button_style.ts";
import type { RowStyle } from "./workbench_rows.ts";
import { type WorkbenchStyledRowRenderCommand, workbenchStyledRowsRenderCommandsInto } from "./workbench_row_render.ts";

/** Minimal style options used by workbench frame painters. */
export interface WorkbenchFramePaintOptions {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

/** Style factory shared by terminal and browser workbench adapters. */
export type WorkbenchFrameStyleFactory = (options?: WorkbenchFramePaintOptions) => (text: string) => string;

/** Theme contract needed for writing styled rows and buttons into a workbench frame. */
export interface WorkbenchFramePainterTheme extends WorkbenchButtonTheme {
  surface: string;
}

/** Frame adapter hooks for the shared workbench painter. */
export interface WorkbenchFramePainterOptions<Frame, Theme extends WorkbenchFramePainterTheme> {
  width: (frame: Frame) => number;
  theme: () => Theme;
  style: WorkbenchFrameStyleFactory;
  contrastText: (color: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  write: (frame: Frame, width: number, row: number, column: number, value: string) => void;
  fillRect?: (frame: Frame, width: number, rect: Rectangle, value: string) => void;
}

/** Shared themed paint adapter for sparse terminal frames and browser string frames. */
export class WorkbenchFramePainter<Frame, Theme extends WorkbenchFramePainterTheme> {
  readonly #options: WorkbenchFramePainterOptions<Frame, Theme>;
  readonly #styledRows: WorkbenchStyledRowRenderCommand[] = [];

  constructor(options: WorkbenchFramePainterOptions<Frame, Theme>) {
    this.#options = options;
  }

  width(frame: Frame): number {
    return this.#options.width(frame);
  }

  paint(text: string, options: WorkbenchFramePaintOptions = {}): string {
    return this.#options.style({
      fg: options.fg ?? this.#options.theme().text,
      bg: options.bg,
      bold: options.bold,
    })(text);
  }

  write(frame: Frame, row: number, column: number, value: string): void {
    this.#options.write(frame, this.width(frame), row, column, value);
  }

  fillRow(frame: Frame, row: number, bg: string): void {
    const width = this.width(frame);
    this.write(frame, row, 0, this.paint(" ".repeat(Math.max(0, width)), { bg }));
  }

  fillRect(frame: Frame, rect: Rectangle, bg: string): void {
    const width = this.width(frame);
    const value = this.paint(" ".repeat(Math.max(0, rect.width)), { bg });
    if (this.#options.fillRect) {
      this.#options.fillRect(frame, width, rect, value);
      return;
    }
    for (let row = rect.row; row < rect.row + rect.height; row += 1) {
      this.#options.write(frame, width, row, rect.column, value);
    }
  }

  writeRows(frame: Frame, rect: Rectangle, rows: readonly RowStyle[], sourceStart = 0): void {
    const commands = workbenchStyledRowsRenderCommandsInto(this.#styledRows, {
      rect,
      rows,
      sourceStart,
      theme: this.#options.theme(),
      fit: this.#options.fit,
    });
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]!;
      this.write(
        frame,
        command.row,
        command.column,
        this.paint(command.text, {
          fg: command.fg,
          bg: command.bg,
          bold: command.bold,
        }),
      );
    }
  }

  writeButton(
    frame: Frame,
    row: number,
    column: number,
    label: string,
    options: {
      state?: "base" | "active" | "disabled";
      tone?: WorkbenchButtonTone;
      compact?: boolean;
      maxWidth?: number;
    } = {},
  ): number {
    const button = projectWorkbenchButton(
      label,
      this.#options.theme(),
      this.#options.contrastText,
      {
        compact: options.compact,
        maxWidth: options.maxWidth,
        state: options.state,
        tone: options.tone,
      },
    );
    if (button.width <= 0) return 0;
    this.write(frame, row, column, this.paint(button.text, button.style));
    return button.width;
  }
}
