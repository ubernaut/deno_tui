// Copyright 2023 Im-Beast. MIT license.
import { createProcessTerminalBackend, type TerminalBackend } from "../runtime/terminal_backend.ts";
import { createSigmaPtyTerminalBackend } from "../runtime/pty_backend.ts";
import { TerminalShellController, type TerminalShellControllerOptions } from "../runtime/terminal_shell.ts";
import type { Rectangle } from "../types.ts";
import { textWidth } from "../utils/strings.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";

type MaybePromise<T> = T | Promise<T>;

/** Options for resolving the API Workbench shell backend. */
export interface WorkbenchShellBackendResolverOptions {
  ptyFactory?: () => MaybePromise<TerminalBackend>;
  processFactory?: () => TerminalBackend;
  onFallback?: (message: string) => void;
}

/** Resolution result for the API Workbench shell backend. */
export interface WorkbenchShellBackendResolution {
  backend: TerminalBackend;
  fallback: boolean;
  reason?: string;
}

/** Options for creating an API Workbench shell controller through the workbench backend resolver. */
export interface WorkbenchShellSessionOptions
  extends Omit<TerminalShellControllerOptions, "backend" | "backendFactory"> {
  resolver?: WorkbenchShellBackendResolverOptions;
}

/** Shell controller plus backend resolution metadata for workbench terminal windows. */
export interface WorkbenchShellSession {
  shell: TerminalShellController;
  resolution: WorkbenchShellBackendResolution;
}

/** Minimal session metadata needed to project terminal session tabs for any renderer. */
export interface WorkbenchTerminalSessionTab {
  id: string;
  title: string;
  running?: boolean;
  status?: string;
}

/** Projected terminal session tab geometry and label. */
export interface WorkbenchTerminalSessionTabPlacement {
  id: string;
  label: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

/** Options for projecting terminal session tabs into one terminal-cell row. */
export interface WorkbenchTerminalSessionTabOptions {
  minWidth?: number;
  maxWidth?: number;
}

/** Resolves the preferred PTY shell backend and falls back to the process backend when PTY is unavailable. */
export async function resolveWorkbenchShellBackend(
  options: WorkbenchShellBackendResolverOptions = {},
): Promise<WorkbenchShellBackendResolution> {
  const ptyFactory = options.ptyFactory ??
    (() => createSigmaPtyTerminalBackend({ pollingIntervalMs: 8 }));
  const processFactory = options.processFactory ?? (() => createProcessTerminalBackend());

  try {
    return {
      backend: await ptyFactory(),
      fallback: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    options.onFallback?.(reason);
    return {
      backend: processFactory(),
      fallback: true,
      reason,
    };
  }
}

/** Creates a workbench shell controller using the same PTY-first backend resolution policy as the demo workbench. */
export async function createWorkbenchShellSession(
  options: WorkbenchShellSessionOptions = {},
): Promise<WorkbenchShellSession> {
  const { resolver, ...shellOptions } = options;
  const resolution = await resolveWorkbenchShellBackend(resolver);
  return {
    shell: new TerminalShellController({
      ...shellOptions,
      backend: resolution.backend,
    }),
    resolution,
  };
}

/** Projects terminal session tabs into a single row, returning caller-owned placements for rendering and hit testing. */
export function workbenchTerminalSessionTabsInto(
  target: WorkbenchTerminalSessionTabPlacement[],
  sessions: readonly WorkbenchTerminalSessionTab[],
  activeId: string | undefined,
  rect: Rectangle,
  options: WorkbenchTerminalSessionTabOptions = {},
): WorkbenchTerminalSessionTabPlacement[] {
  target.length = 0;
  if (rect.width <= 0 || rect.height <= 0) return target;
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 4));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 22));
  let column = rect.column;
  const endColumn = rect.column + rect.width;
  for (let index = 0; index < sessions.length && column < endColumn; index += 1) {
    const session = sessions[index]!;
    const active = session.id === activeId;
    const status = session.running ? "*" : session.status?.[0]?.toUpperCase() ?? "?";
    const available = endColumn - column;
    const width = Math.max(
      1,
      Math.min(available, Math.max(minWidth, Math.min(maxWidth, textWidth(session.title) + 6))),
    );
    const label = fitCellText(buttonText(`${status} ${session.title}`), width);
    target.push({
      id: session.id,
      label,
      column,
      row: rect.row,
      width: textWidth(label),
      active,
    });
    column += width + 1;
  }
  return target;
}
