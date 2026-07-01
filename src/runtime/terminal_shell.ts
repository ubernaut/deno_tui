// Copyright 2023 Im-Beast. MIT license.
import { TerminalOutputController } from "../components/terminal_output.ts";
import { Signal } from "../signals/mod.ts";
import { createProcessTerminalBackend, type TerminalBackend, type TerminalSessionHandle } from "./terminal_backend.ts";
import {
  formatProcessCommandLine,
  type ProcessSessionCommand,
  type ProcessSessionExit,
  type ProcessSessionStatus,
} from "./process_session.ts";
import { TerminalScreenController, type TerminalScreenInspection } from "./terminal_screen.ts";
import { shellTerminalTemplate, terminalTemplateToSpawnOptions } from "./terminal_templates.ts";

/** Options for an interactive shell session backed by a terminal backend. */
export interface TerminalShellControllerOptions {
  backend?: TerminalBackend;
  backendFactory?: () => TerminalBackend | Promise<TerminalBackend>;
  shell?: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
  columns?: number;
  rows?: number;
  scrollbackLimit?: number;
  output?: TerminalOutputController;
  screen?: TerminalScreenController;
  now?: () => number;
  onUpdate?: () => void;
}

/** Serializable inspection snapshot for TerminalShellController. */
export interface TerminalShellInspection {
  title?: string;
  status: ProcessSessionStatus | "starting";
  running: boolean;
  backendId?: string;
  backendLabel?: string;
  pty: boolean;
  command: ProcessSessionCommand;
  commandLine: string;
  columns: number;
  rows: number;
  resizeSupported: boolean;
  screen: TerminalScreenInspection;
  exit?: ProcessSessionExit;
  error?: string;
}

/** Interactive shell controller that streams raw backend data into a terminal screen model. */
export class TerminalShellController {
  readonly status = new Signal<ProcessSessionStatus | "starting">("idle");
  readonly output: TerminalOutputController;
  readonly screen: TerminalScreenController;
  readonly #backend?: TerminalBackend;
  readonly #backendFactory?: () => TerminalBackend | Promise<TerminalBackend>;
  readonly #shell?: string;
  readonly #args?: readonly string[];
  readonly #cwd?: string;
  readonly #env?: Record<string, string>;
  readonly #now: () => number;
  readonly #onUpdate?: () => void;
  #session?: TerminalSessionHandle;
  #backendLabel?: string;
  #pty = false;
  #columns: number;
  #rows: number;
  #error?: string;
  #command: ProcessSessionCommand;

  constructor(options: TerminalShellControllerOptions = {}) {
    this.#backend = options.backend;
    this.#backendFactory = options.backendFactory;
    this.#shell = options.shell;
    this.#args = options.args ? [...options.args] : undefined;
    this.#cwd = options.cwd;
    this.#env = options.env ? { ...options.env } : undefined;
    this.#columns = normalizeTerminalShellDimension(options.columns, 80);
    this.#rows = normalizeTerminalShellDimension(options.rows, 24);
    this.#now = options.now ?? (() => Date.now());
    this.#onUpdate = options.onUpdate;
    this.output = options.output ?? new TerminalOutputController();
    this.screen = options.screen ??
      new TerminalScreenController({
        columns: this.#columns,
        rows: this.#rows,
        scrollbackLimit: options.scrollbackLimit,
      });
    this.#command = shellTerminalTemplate({
      shell: this.#shell,
      args: this.#args,
      cwd: this.#cwd,
      env: this.#env,
      columns: this.#columns,
      rows: this.#rows,
    });
  }

  get running(): boolean {
    return this.status.peek() === "running";
  }

  async start(): Promise<boolean> {
    if (this.status.peek() === "starting" || this.running) return false;
    this.#error = undefined;
    this.status.value = "starting";
    this.#onUpdate?.();

    const template = shellTerminalTemplate({
      shell: this.#shell,
      args: this.#args,
      cwd: this.#cwd,
      env: this.#env,
      columns: this.#columns,
      rows: this.#rows,
    });
    this.#command = template;

    try {
      const backend = await this.#resolveBackend();
      this.#backendLabel = backend.label;
      this.#pty = backend.pty;
      this.screen.resize(this.#columns, this.#rows);
      const handle = backend.spawn({
        ...terminalTemplateToSpawnOptions(template, {
          columns: this.#columns,
          rows: this.#rows,
        }),
        output: this.output,
        onData: (data) => {
          this.screen.write(data);
          this.#onUpdate?.();
        },
      });
      this.#session = handle;
      this.status.value = "running";
      this.#onUpdate?.();
      void handle.closed.then((inspection) => {
        if (this.#session !== handle) return;
        this.status.value = inspection.status;
        this.#onUpdate?.();
      }).catch((error) => {
        if (this.#session !== handle) return;
        this.#error = error instanceof Error ? error.message : String(error);
        this.status.value = "failed";
        this.output.appendText("system", `shell failed: ${this.#error}`, this.#now());
        this.#onUpdate?.();
      });
      return true;
    } catch (error) {
      this.#error = error instanceof Error ? error.message : String(error);
      this.status.value = "failed";
      this.output.appendText("system", `shell failed: ${this.#error}`, this.#now());
      this.#onUpdate?.();
      return false;
    }
  }

  async restart(): Promise<boolean> {
    if (this.running) await this.stop();
    this.clear();
    return await this.start();
  }

  async stop(signal: Deno.Signal = "SIGTERM"): Promise<boolean> {
    const session = this.#session;
    if (!session) return false;
    const stopped = await session.kill(signal);
    if (stopped) this.status.value = "cancelled";
    this.#onUpdate?.();
    return stopped;
  }

  async write(data: string | Uint8Array): Promise<boolean> {
    if (!this.#session || !this.running) return false;
    return await this.#session.write(data);
  }

  resize(columns: number, rows: number): void {
    const nextColumns = normalizeTerminalShellDimension(columns, this.#columns);
    const nextRows = normalizeTerminalShellDimension(rows, this.#rows);
    if (nextColumns === this.#columns && nextRows === this.#rows) return;
    this.#columns = nextColumns;
    this.#rows = nextRows;
    this.screen.resize(nextColumns, nextRows);
    void this.#session?.resize(nextColumns, nextRows).then(() => this.#onUpdate?.());
  }

  clear(): void {
    this.screen.clear();
    this.output.clear();
    this.#onUpdate?.();
  }

  inspect(): TerminalShellInspection {
    const session = this.#session?.inspect();
    const status = this.status.peek();
    const command = cloneShellCommand(this.#command);
    const screen = this.screen.inspect();
    const result: TerminalShellInspection = {
      title: screen.title,
      status,
      running: status === "running",
      backendId: session?.backendId,
      backendLabel: this.#backendLabel,
      pty: this.#pty,
      command,
      commandLine: session?.commandLine ?? formatProcessCommandLine(command),
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: session?.resizeSupported ?? false,
      screen,
    };
    if (session?.exit) result.exit = { ...session.exit };
    if (this.#error) result.error = this.#error;
    return result;
  }

  async dispose(): Promise<void> {
    await this.#session?.dispose();
    this.output.dispose();
    this.status.dispose();
  }

  async #resolveBackend(): Promise<TerminalBackend> {
    if (this.#backend) return this.#backend;
    if (this.#backendFactory) return await this.#backendFactory();
    return createProcessTerminalBackend();
  }
}

function cloneShellCommand(command: ProcessSessionCommand): ProcessSessionCommand {
  return {
    command: command.command,
    args: command.args ? [...command.args] : undefined,
    cwd: command.cwd,
    env: command.env ? { ...command.env } : undefined,
  };
}

function normalizeTerminalShellDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}
