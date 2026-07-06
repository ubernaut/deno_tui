import type { WorkbenchFrame } from "../src/app/workbench/mod.ts";
import { type WorkbenchTerminalSessionTabBufferCache } from "../src/app/workbench_buffers.ts";
import {
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTabSourcesInto,
} from "../src/app/workbench_terminal.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

export interface ApiWorkbenchTerminalSessionTabsRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  inspection: TerminalShellWorkspaceInspection;
  buffers: WorkbenchTerminalSessionTabBufferCache;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: { type: "terminalShellSession"; id: string }) => void;
}

/** Renders the shell session tab strip while keeping terminal shell lifecycle state in the app. */
export function renderApiWorkbenchTerminalSessionTabs(
  options: ApiWorkbenchTerminalSessionTabsRenderOptions,
): number {
  const { frame, rect, startRow, inspection, buffers, theme, contrastText, paint, write, addHit } = options;
  if (startRow >= rect.row + rect.height) return startRow;

  workbenchTerminalSessionTabSourcesInto(buffers.sources, inspection.sessions);
  workbenchTerminalSessionTabsInto(
    buffers.placements,
    buffers.sources,
    inspection.activeId,
    { column: rect.column, row: startRow, width: rect.width, height: 1 },
  );
  workbenchTerminalSessionTabRenderCommandsInto(
    buffers.commands,
    buffers.placements,
    { column: rect.column, row: startRow, width: rect.width, height: 1 },
  );

  for (const command of buffers.commands) {
    const style = command.active
      ? { fg: contrastText(theme.accent, theme.background, theme.text), bg: theme.accent, bold: true }
      : { fg: theme.text, bg: theme.panelSoft, bold: false };
    write(frame, command.rect.row, command.rect.column, paint(command.text, style));
    if (command.kind === "tab" && command.id) {
      addHit(command.rect, { type: "terminalShellSession", id: command.id });
    }
  }
  return startRow + 1;
}
