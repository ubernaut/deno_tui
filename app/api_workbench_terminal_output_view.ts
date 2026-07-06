import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import { projectWorkbenchButtonCommand } from "../src/app/workbench_button_style.ts";
import type { WorkbenchButtonRowBufferCache } from "../src/app/workbench_buffers.ts";
import type {
  WorkbenchTerminalOutputToolbarAction,
  WorkbenchTerminalOutputToolbarState,
  WorkbenchTerminalOutputWindowRow,
} from "../src/app/workbench_terminal.ts";
import {
  workbenchTerminalOutputToolbarItemsInto,
  workbenchTerminalOutputWindowRowsInto,
} from "../src/app/workbench_terminal.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { TerminalOutputLine } from "../src/components/terminal_output.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import {
  formatTerminalOutputHint,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
} from "../src/runtime/terminal_status.ts";
import type { Rectangle } from "../src/types.ts";
import {
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
  type ApiWorkbenchThemeSpec,
} from "./api_workbench_catalog.ts";

interface ApiWorkbenchTerminalOutputPaintStyle {
  fg: string;
  bg: string;
  bold?: boolean;
}

export interface ApiWorkbenchTerminalOutputToolbarRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  state: WorkbenchTerminalOutputToolbarState;
  buffers: WorkbenchButtonRowBufferCache<WorkbenchTerminalOutputToolbarAction>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: { type: "terminalOutput"; action: WorkbenchTerminalOutputToolbarAction }) => void;
}

export interface ApiWorkbenchTerminalOutputBodyRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  inspection: ProcessSessionInspection;
  inputMode: "raw" | "workbench";
  lines: readonly TerminalOutputLine[];
  rows: WorkbenchTerminalOutputWindowRow[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchTerminalOutputPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
}

/** Renders the process-output terminal toolbar with shared button-row projection helpers. */
export function renderApiWorkbenchTerminalOutputToolbar(
  options: ApiWorkbenchTerminalOutputToolbarRenderOptions,
): number {
  const { frame, rect, startRow, state, buffers, theme, contrastText, paint, write, addHit } = options;
  workbenchTerminalOutputToolbarItemsInto(buffers.items, state);
  const nextRow = layoutWorkbenchButtonRowInto(
    buffers.placements,
    buffers.items,
    rect,
    startRow,
  );

  workbenchButtonRowRenderCommandsInto(buffers.commands, buffers.placements);
  for (const button of buffers.commands) {
    const projection = projectWorkbenchButtonCommand(button, theme, contrastText);
    write(frame, button.rect.row, button.rect.column, paint(projection.text, projection.style));
    if (!button.item.disabled) {
      addHit(button.hitRect, { type: "terminalOutput", action: button.item.action });
    }
  }
  return nextRow;
}

/** Renders the process-output terminal body below the toolbar. */
export function renderApiWorkbenchTerminalOutputBody(
  options: ApiWorkbenchTerminalOutputBodyRenderOptions,
): number {
  const { frame, rect, startRow, inspection, inputMode, lines, rows, theme, contrastText, fit, paint, write } = options;
  const statusTone = apiWorkbenchTerminalStatusToneColor(inspection.status, theme);
  const statusSummary = summarizeTerminalStatus(inspection, {
    title: terminalInputModeDisplayLabel(inputMode),
    backendId: "process",
    width: rect.width,
  });
  const projectedRows = workbenchTerminalOutputWindowRowsInto(rows, {
    statusText: statusSummary.text,
    hintText: formatTerminalOutputHint(inputMode),
    lines,
    sourcePrefix: true,
  });
  const maxRows = Math.min(projectedRows.length, Math.max(0, rect.row + rect.height - startRow));
  for (let index = 0; index < maxRows; index += 1) {
    const projected = projectedRows[index]!;
    const style = projected.kind === "status"
      ? {
        fg: contrastText(statusTone, theme.background, theme.text),
        bg: statusTone,
        bold: true,
      }
      : projected.kind === "hint"
      ? { fg: theme.soft, bg: theme.panelSoft }
      : projected.kind === "empty"
      ? { fg: theme.muted, bg: theme.surface }
      : apiWorkbenchTerminalOutputLineStyle(projected.source ?? "stdout", theme);
    write(
      frame,
      startRow + index,
      rect.column,
      paint(fit(projected.text, rect.width), style),
    );
  }
  return maxRows;
}
