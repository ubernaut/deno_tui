// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { formatProcessCommandLine } from "./process_session.ts";
import {
  describeAttachTerminalTemplate,
  isSpawnTerminalTemplate,
  type TerminalSessionDescriptor,
  type TerminalTemplate,
} from "./terminal_templates.ts";

/** Options for constructing a terminal workspace controller. */
export interface TerminalWorkspaceControllerOptions {
  sessions?: readonly TerminalSessionDescriptor[];
  activeId?: string;
  now?: () => number;
}

/** Options for adding a terminal template to a workspace. */
export interface AddTerminalWorkspaceSessionOptions {
  title?: string;
  backendId?: string;
  columns?: number;
  rows?: number;
  status?: TerminalSessionDescriptor["status"];
  running?: boolean;
  activate?: boolean;
}

/** Options for inserting or replacing a terminal workspace descriptor. */
export interface UpsertTerminalWorkspaceSessionOptions {
  activate?: boolean;
}

/** Serializable terminal workspace state. */
export interface TerminalWorkspaceInspection {
  activeId?: string;
  active?: TerminalSessionDescriptor;
  sessions: TerminalSessionDescriptor[];
  count: number;
}

/** Renderer-neutral session/tab model for tmux-like terminal workspaces. */
export class TerminalWorkspaceController {
  readonly sessions: Signal<TerminalSessionDescriptor[]>;
  readonly activeId: Signal<string | undefined>;
  readonly #now: () => number;

  constructor(options: TerminalWorkspaceControllerOptions = {}) {
    this.#now = options.now ?? (() => Date.now());
    const sessions = (options.sessions ?? []).map((session) => cloneTerminalSessionDescriptor(session));
    const activeId = options.activeId && sessions.some((session) => session.id === options.activeId)
      ? options.activeId
      : sessions[0]?.id;
    this.sessions = new Signal(sessions);
    this.activeId = new Signal<string | undefined>(activeId);
  }

  get active(): TerminalSessionDescriptor | undefined {
    const id = this.activeId.peek();
    return id ? this.sessions.peek().find((session) => session.id === id) : undefined;
  }

  add(template: TerminalTemplate, options: AddTerminalWorkspaceSessionOptions = {}): TerminalSessionDescriptor {
    const descriptor = descriptorFromTemplate(template, options, this.#now());
    return this.upsert(descriptor, {
      activate: options.activate ?? this.sessions.peek().length === 0,
    });
  }

  upsert(
    descriptor: TerminalSessionDescriptor,
    options: UpsertTerminalWorkspaceSessionOptions = {},
  ): TerminalSessionDescriptor {
    const nextDescriptor = cloneTerminalSessionDescriptor(descriptor);
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === nextDescriptor.id);
    this.sessions.value = index >= 0
      ? sessions.map((session, sessionIndex) => sessionIndex === index ? nextDescriptor : session)
      : [...sessions, nextDescriptor];
    if (options.activate || !this.activeId.peek()) this.activeId.value = nextDescriptor.id;
    return cloneTerminalSessionDescriptor(nextDescriptor);
  }

  activate(id: string): boolean {
    if (!this.sessions.peek().some((session) => session.id === id)) return false;
    this.activeId.value = id;
    return true;
  }

  remove(id: string): boolean {
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const next = sessions.filter((session) => session.id !== id);
    this.sessions.value = next;
    if (this.activeId.peek() === id) {
      this.activeId.value = next[index]?.id ?? next[index - 1]?.id;
    }
    return true;
  }

  rename(id: string, title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    descriptor.title = trimmed;
    descriptor.updatedAt = this.#now();
    this.sessions.value = sessions.map((session, sessionIndex) => sessionIndex === index ? descriptor : session);
    return true;
  }

  move(id: string, delta: number): boolean {
    const sessions = [...this.sessions.peek()];
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0 || sessions.length < 2) return false;
    const nextIndex = Math.max(0, Math.min(sessions.length - 1, index + Math.trunc(delta)));
    if (nextIndex === index) return false;
    const [session] = sessions.splice(index, 1);
    sessions.splice(nextIndex, 0, session!);
    this.sessions.value = sessions;
    return true;
  }

  clear(): void {
    this.sessions.value = [];
    this.activeId.value = undefined;
  }

  inspect(): TerminalWorkspaceInspection {
    const sessions = this.sessions.peek().map((session) => cloneTerminalSessionDescriptor(session));
    const activeId = this.activeId.peek();
    const active = activeId ? sessions.find((session) => session.id === activeId) : undefined;
    return {
      activeId,
      active,
      sessions,
      count: sessions.length,
    };
  }

  dispose(): void {
    this.sessions.dispose();
    this.activeId.dispose();
  }
}

/** Creates a terminal workspace controller. */
export function createTerminalWorkspaceController(
  options: TerminalWorkspaceControllerOptions = {},
): TerminalWorkspaceController {
  return new TerminalWorkspaceController(options);
}

function descriptorFromTemplate(
  template: TerminalTemplate,
  options: AddTerminalWorkspaceSessionOptions,
  now: number,
): TerminalSessionDescriptor {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...describeAttachTerminalTemplate(template, now),
      title: options.title ?? template.title,
      backendId: options.backendId,
      columns: normalizeDimension(options.columns),
      rows: normalizeDimension(options.rows),
      status: options.status,
      running: options.running,
    };
  }
  const commandLine = formatProcessCommandLine(template);
  return {
    id: template.id,
    title: options.title ?? template.title,
    template: cloneTerminalTemplate(template),
    backendId: options.backendId,
    commandLine,
    status: options.status ?? "idle",
    running: options.running ?? false,
    columns: normalizeDimension(options.columns ?? template.columns),
    rows: normalizeDimension(options.rows ?? template.rows),
    reconnectable: template.reconnectable ?? false,
    restartPolicy: template.restartPolicy ?? "never",
    createdAt: now,
    updatedAt: now,
  };
}

function cloneTerminalSessionDescriptor(descriptor: TerminalSessionDescriptor): TerminalSessionDescriptor {
  return {
    ...descriptor,
    template: cloneTerminalTemplate(descriptor.template),
  };
}

function cloneTerminalTemplate(template: TerminalTemplate): TerminalTemplate {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...template,
      metadata: template.metadata ? { ...template.metadata } : undefined,
    };
  }
  return {
    ...template,
    args: template.args ? [...template.args] : undefined,
    env: template.env ? { ...template.env } : undefined,
    metadata: template.metadata ? { ...template.metadata } : undefined,
  };
}

function normalizeDimension(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value!));
}
