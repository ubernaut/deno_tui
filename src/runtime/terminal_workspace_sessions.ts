// Copyright 2023 Im-Beast. MIT license.
import { formatProcessCommandLine } from "./process_session.ts";
import {
  describeAttachTerminalTemplate,
  isSpawnTerminalTemplate,
  type TerminalSessionDescriptor,
  type TerminalTemplate,
} from "./terminal_templates.ts";
import { sanitizeTerminalWorkspaceLayoutId } from "./terminal_workspace_layout.ts";

/** Options used when materializing a terminal template into a workspace descriptor. */
export interface TerminalWorkspaceDescriptorOptions {
  title?: string;
  backendId?: string;
  columns?: number;
  rows?: number;
  status?: TerminalSessionDescriptor["status"];
  running?: boolean;
}

/** Options used when duplicating a terminal workspace descriptor. */
export interface DuplicateTerminalWorkspaceDescriptorOptions {
  id?: string;
  title?: string;
}

/** Creates a terminal workspace descriptor from a spawn or attach template. */
export function descriptorFromTerminalTemplate(
  template: TerminalTemplate,
  options: TerminalWorkspaceDescriptorOptions,
  now: number,
): TerminalSessionDescriptor {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...describeAttachTerminalTemplate(template, now),
      title: options.title ?? template.title,
      backendId: options.backendId,
      columns: normalizeTerminalWorkspaceDimension(options.columns),
      rows: normalizeTerminalWorkspaceDimension(options.rows),
      status: options.status,
      running: options.running,
      detached: false,
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
    columns: normalizeTerminalWorkspaceDimension(options.columns ?? template.columns),
    rows: normalizeTerminalWorkspaceDimension(options.rows ?? template.rows),
    reconnectable: template.reconnectable ?? false,
    restartPolicy: template.restartPolicy ?? "never",
    createdAt: now,
    updatedAt: now,
  };
}

/** Clones a terminal workspace descriptor without sharing nested template state. */
export function cloneTerminalSessionDescriptor(descriptor: TerminalSessionDescriptor): TerminalSessionDescriptor {
  return {
    ...descriptor,
    template: cloneTerminalTemplate(descriptor.template),
  };
}

/** Creates a restartable duplicate descriptor with a unique id and reset spawn status. */
export function duplicateTerminalSessionDescriptor(
  source: TerminalSessionDescriptor,
  sessions: readonly TerminalSessionDescriptor[],
  options: DuplicateTerminalWorkspaceDescriptorOptions,
  now: number,
): TerminalSessionDescriptor {
  const ids = new Set<string>();
  for (let index = 0; index < sessions.length; index += 1) ids.add(sessions[index]!.id);
  const id = uniqueTerminalWorkspaceSessionId(options.id ?? `${source.id}-copy`, ids);
  const title = options.title ?? `${source.title} Copy`;
  const template = cloneTerminalTemplate(source.template);
  template.id = id;
  template.title = title;

  const descriptor: TerminalSessionDescriptor = {
    ...cloneTerminalSessionDescriptor(source),
    id,
    title,
    runtimeTitle: undefined,
    template,
    status: isSpawnTerminalTemplate(template) ? "idle" : source.status,
    running: isSpawnTerminalTemplate(template) ? false : source.running,
    detached: false,
    createdAt: now,
    updatedAt: now,
  };
  if (isSpawnTerminalTemplate(template)) descriptor.commandLine = formatProcessCommandLine(template);
  return descriptor;
}

/** Returns whether an OSC/runtime title should replace the visible workspace title. */
export function shouldAdoptRuntimeTitle(
  descriptor: TerminalSessionDescriptor,
  previousRuntimeTitle: string | undefined,
): boolean {
  return descriptor.title === descriptor.template.title ||
    descriptor.title === previousRuntimeTitle ||
    descriptor.title === descriptor.runtimeTitle;
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

function normalizeTerminalWorkspaceDimension(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value!));
}

function uniqueTerminalWorkspaceSessionId(prefix: string, ids: ReadonlySet<string>): string {
  const base = sanitizeTerminalWorkspaceLayoutId(prefix);
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
