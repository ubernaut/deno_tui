// Copyright 2023 Im-Beast. MIT license.

import type { TerminalMouseProtocol, TerminalPlan } from "./terminal_capabilities.ts";

/** Minimal async-compatible byte writer used by terminal session setup. */
export interface TerminalSessionWriter {
  write(data: Uint8Array): number | Promise<number>;
}

/** Options for composing terminal enter/exit behavior from a terminal plan. */
export interface TerminalSessionOptions {
  plan: TerminalPlan;
  hideCursor?: boolean;
}

/** Escape sequences needed to enter and exit an app terminal session. */
export interface TerminalSessionSequences {
  enter: string;
  exit: string;
}

/** Serializable terminal session status for diagnostics and tests. */
export interface TerminalSessionInspection {
  active: boolean;
  alternateScreen: boolean;
  bracketedPaste: boolean;
  focusEvents: boolean;
  mouseProtocol: TerminalMouseProtocol;
  hideCursor: boolean;
}

const ESC = "\x1b";
const ENCODER = new TextEncoder();

/** Builds terminal setup and teardown escape sequences from a terminal plan. */
export function terminalSessionSequences(options: TerminalSessionOptions): TerminalSessionSequences {
  const enter: string[] = [];
  const exit: string[] = [];
  const interactive = options.plan.capabilities.interactive;
  const hideCursor = interactive && (options.hideCursor ?? true);

  if (interactive && options.plan.alternateScreen) {
    enter.push(`${ESC}[?1049h`);
    exit.unshift(`${ESC}[?1049l`);
  }
  if (hideCursor) {
    enter.push(`${ESC}[?25l`);
    exit.unshift(`${ESC}[?25h`);
  }
  if (interactive && options.plan.bracketedPaste) {
    enter.push(`${ESC}[?2004h`);
    exit.unshift(`${ESC}[?2004l`);
  }
  if (interactive && options.plan.focusEvents) {
    enter.push(`${ESC}[?1004h`);
    exit.unshift(`${ESC}[?1004l`);
  }

  const mouse = terminalMouseSequences(interactive ? options.plan.mouseProtocol : "none");
  if (mouse.enter) enter.push(mouse.enter);
  if (mouse.exit) exit.unshift(mouse.exit);

  return {
    enter: enter.join(""),
    exit: exit.join(""),
  };
}

/** Builds mouse protocol setup and teardown escape sequences. */
export function terminalMouseSequences(
  protocol: TerminalMouseProtocol,
): TerminalSessionSequences {
  switch (protocol) {
    case "x10":
      return { enter: `${ESC}[?9h`, exit: `${ESC}[?9l` };
    case "vt200":
      return { enter: `${ESC}[?1000h`, exit: `${ESC}[?1000l` };
    case "sgr":
      return { enter: `${ESC}[?1000h${ESC}[?1006h`, exit: `${ESC}[?1006l${ESC}[?1000l` };
    case "none":
      return { enter: "", exit: "" };
  }
}

/** Creates an idempotent terminal session controller around an injectable writer. */
export function createTerminalSessionController(
  writer: TerminalSessionWriter,
  options: TerminalSessionOptions,
): TerminalSessionController {
  return new TerminalSessionController(writer, options);
}

/** Idempotently writes terminal enter/exit sequences for full-screen TUI sessions. */
export class TerminalSessionController {
  readonly #writer: TerminalSessionWriter;
  readonly #options: TerminalSessionOptions;
  #active = false;

  constructor(writer: TerminalSessionWriter, options: TerminalSessionOptions) {
    this.#writer = writer;
    this.#options = options;
  }

  get active(): boolean {
    return this.#active;
  }

  sequences(): TerminalSessionSequences {
    return terminalSessionSequences(this.#options);
  }

  async enter(): Promise<void> {
    if (this.#active) return;
    const sequence = this.sequences().enter;
    if (sequence) await this.write(sequence);
    this.#active = true;
  }

  async exit(): Promise<void> {
    if (!this.#active) return;
    const sequence = this.sequences().exit;
    if (sequence) await this.write(sequence);
    this.#active = false;
  }

  dispose(): Promise<void> {
    return this.exit();
  }

  inspect(): TerminalSessionInspection {
    const interactive = this.#options.plan.capabilities.interactive;
    return {
      active: this.#active,
      alternateScreen: interactive && this.#options.plan.alternateScreen,
      bracketedPaste: interactive && this.#options.plan.bracketedPaste,
      focusEvents: interactive && this.#options.plan.focusEvents,
      mouseProtocol: interactive ? this.#options.plan.mouseProtocol : "none",
      hideCursor: interactive && (this.#options.hideCursor ?? true),
    };
  }

  private async write(sequence: string): Promise<void> {
    await this.#writer.write(ENCODER.encode(sequence));
  }
}
