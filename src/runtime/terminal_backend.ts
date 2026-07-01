// Copyright 2023 Im-Beast. MIT license.
import type { TerminalOutputController, TerminalOutputSource } from "../components/terminal_output.ts";
import {
  formatProcessCommandLine,
  type ProcessSessionCommand,
  ProcessSessionController,
  type ProcessSessionControllerOptions,
  type ProcessSessionExit,
  type ProcessSessionInspection,
  type ProcessSessionSpawner,
  type ProcessSessionStatus,
} from "./process_session.ts";

/** Command and geometry options for spawning a terminal session backend. */
export interface TerminalBackendSpawnOptions extends ProcessSessionCommand {
  columns?: number;
  rows?: number;
  output?: TerminalOutputController;
  onData?: (data: string | Uint8Array, source: TerminalOutputSource) => void;
}

/** Options used when reattaching to a backend-owned terminal session. */
export interface TerminalBackendAttachOptions {
  columns?: number;
  rows?: number;
  output?: TerminalOutputController;
}

/** Serializable descriptor for a session retained by a backend outside the active window handle. */
export interface TerminalDetachedSession {
  id: string;
  backendId: string;
  title?: string;
  commandLine?: string;
  columns?: number;
  rows?: number;
  createdAt?: number;
  updatedAt?: number;
  metadata?: Record<string, string>;
}

/** Serializable inspection snapshot for terminal backend sessions. */
export interface TerminalSessionHandleInspection {
  id: string;
  backendId: string;
  title?: string;
  commandLine: string;
  status: ProcessSessionStatus;
  running: boolean;
  columns: number;
  rows: number;
  resizeSupported: boolean;
  detached?: boolean;
  reconnectable?: boolean;
  exit?: ProcessSessionExit;
}

/** Runtime handle returned by terminal backends. */
export interface TerminalSessionHandle {
  readonly id: string;
  readonly backendId: string;
  readonly command: ProcessSessionCommand;
  readonly output: TerminalOutputController;
  readonly closed: Promise<ProcessSessionInspection>;
  write(data: string | Uint8Array): Promise<boolean>;
  resize(columns: number, rows: number): Promise<boolean>;
  kill(signal?: Deno.Signal): Promise<boolean>;
  inspect(): TerminalSessionHandleInspection;
  dispose(): Promise<void>;
}

/** Backend abstraction for process, PTY, tmux, or remote terminal sessions. */
export interface TerminalBackend {
  readonly id: string;
  readonly label: string;
  readonly pty: boolean;
  readonly detachable?: boolean;
  readonly reconnectable?: boolean;
  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle;
  attach?(
    sessionId: string,
    options?: TerminalBackendAttachOptions,
  ): TerminalSessionHandle | Promise<TerminalSessionHandle>;
  detach?(session: TerminalSessionHandle): Promise<TerminalDetachedSession | undefined>;
  listDetached?(): Promise<TerminalDetachedSession[]>;
}

/** Options for configuring the process-backed terminal backend. */
export interface ProcessTerminalBackendOptions {
  id?: string;
  label?: string;
  spawn?: ProcessSessionSpawner;
}

/** Creates the default non-PTY process terminal backend. */
export function createProcessTerminalBackend(options: ProcessTerminalBackendOptions = {}): TerminalBackend {
  return new ProcessTerminalBackend(options);
}

/** Non-PTY terminal backend implemented with ProcessSessionController and Deno.Command. */
export class ProcessTerminalBackend implements TerminalBackend {
  readonly id: string;
  readonly label: string;
  readonly pty = false;
  readonly detachable = false;
  readonly reconnectable = false;
  readonly #spawn?: ProcessSessionSpawner;

  constructor(options: ProcessTerminalBackendOptions = {}) {
    this.id = options.id ?? "process";
    this.label = options.label ?? "Process";
    this.#spawn = options.spawn;
  }

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    const controllerOptions: ProcessSessionControllerOptions = {
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      env: options.env,
      output: options.output,
      spawn: this.#spawn,
      onOutputData: options.onData ? (source, data) => options.onData?.(data, source) : undefined,
    };
    const session = new ProcessSessionController(controllerOptions);
    return new ProcessTerminalSessionHandle({
      backendId: this.id,
      session,
      columns: options.columns,
      rows: options.rows,
    });
  }
}

class ProcessTerminalSessionHandle implements TerminalSessionHandle {
  readonly id: string;
  readonly backendId: string;
  readonly command: ProcessSessionCommand;
  readonly output: TerminalOutputController;
  readonly closed: Promise<ProcessSessionInspection>;
  readonly #session: ProcessSessionController;
  #columns: number;
  #rows: number;

  constructor(options: {
    backendId: string;
    session: ProcessSessionController;
    columns?: number;
    rows?: number;
  }) {
    this.id = crypto.randomUUID();
    this.backendId = options.backendId;
    this.#session = options.session;
    this.command = this.#session.command.peek();
    this.output = this.#session.output;
    this.#columns = normalizeTerminalDimension(options.columns, 80);
    this.#rows = normalizeTerminalDimension(options.rows, 24);
    this.closed = this.#session.start().then(() => this.#session.inspect());
  }

  write(data: string | Uint8Array): Promise<boolean> {
    return this.#session.writeInput(data);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = normalizeTerminalDimension(columns, this.#columns);
    this.#rows = normalizeTerminalDimension(rows, this.#rows);
    return Promise.resolve(false);
  }

  kill(signal?: Deno.Signal): Promise<boolean> {
    return this.#session.stop(signal);
  }

  inspect(): TerminalSessionHandleInspection {
    const inspection = this.#session.inspect();
    const result: TerminalSessionHandleInspection = {
      id: this.id,
      backendId: this.backendId,
      commandLine: formatProcessCommandLine(this.command),
      status: inspection.status,
      running: inspection.running,
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: false,
    };
    if (inspection.exit) result.exit = inspection.exit;
    return result;
  }

  dispose(): Promise<void> {
    return this.#session.dispose();
  }
}

function normalizeTerminalDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}
