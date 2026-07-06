import type { WorkbenchButtonRowBufferCache, WorkbenchTerminalBufferCache } from "../src/app/workbench_buffers.ts";
import type { WorkbenchFrame } from "../src/app/workbench/mod.ts";
import { type WorkbenchTerminalSessionTabBufferCache } from "../src/app/workbench_buffers.ts";
import {
  type WorkbenchTerminalCopyRowProjection,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalOutputToolbarAction,
  workbenchTerminalOutputToolbarItemsInto,
  type WorkbenchTerminalOutputToolbarState,
  type WorkbenchTerminalOutputWindowRow,
  workbenchTerminalOutputWindowRowsInto,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTabSourcesInto,
  type WorkbenchTerminalShellHeaderRow,
  workbenchTerminalShellHeaderRowsInto,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
  type WorkbenchTerminalToolbarState,
} from "../src/app/workbench_terminal.ts";
import type { TerminalOutputLine } from "../src/components/terminal_output.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import {
  formatTerminalOutputHint,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
} from "../src/runtime/terminal_status.ts";
import type { TerminalShellController, TerminalShellInspection } from "../src/runtime/terminal_shell.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";
import type { Rectangle } from "../src/types.ts";
import {
  apiWorkbenchTerminalCellStyle,
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
  type ApiWorkbenchThemeSpec,
} from "./api_workbench_catalog.ts";
import { renderApiWorkbenchButtonRow } from "./api_workbench_window_view.ts";

type TerminalShellViewHitAction =
  | { type: "terminalShellPane"; id: string }
  | { type: "terminalShellContent" }
  | { type: "terminalShellCopyRow"; index: number };

interface ApiWorkbenchTerminalShellPaintStyle {
  fg: string;
  bg: string;
  bold?: boolean;
}

interface ApiWorkbenchTerminalShellPaintCallbacks {
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchTerminalShellPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
}

interface ApiWorkbenchTerminalSessionTabsInspection {
  activeId?: string;
  sessions: readonly { id: string; title: string }[];
}

interface ApiWorkbenchTerminalSessionTabsRenderOptions<
  Frame = WorkbenchFrame,
  HitType extends string = "terminalShellSession",
> {
  frame: Frame;
  rect: Rectangle;
  startRow: number;
  inspection: ApiWorkbenchTerminalSessionTabsInspection;
  buffers: WorkbenchTerminalSessionTabBufferCache;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: { type: HitType; id: string }) => void;
  hitType?: HitType;
}

interface ApiWorkbenchTerminalShellToolbarRenderOptions<
  Frame = WorkbenchFrame,
  HitType extends string = "terminalShell",
> {
  frame: Frame;
  rect: Rectangle;
  startRow: number;
  state: WorkbenchTerminalToolbarState;
  buffers: WorkbenchButtonRowBufferCache<WorkbenchTerminalToolbarAction>;
  actions?: readonly WorkbenchTerminalToolbarAction[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: { type: HitType; action: WorkbenchTerminalToolbarAction }) => void;
  hitType?: HitType;
}

interface ApiWorkbenchTerminalOutputToolbarRenderOptions {
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

interface ApiWorkbenchTerminalOutputBodyRenderOptions {
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
  paint: (text: string, style: ApiWorkbenchTerminalShellPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
}

interface ApiWorkbenchTerminalShellHeaderRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  inspection: TerminalShellInspection;
  inputMode: "raw" | "workbench";
  copyMode: boolean;
  rows: WorkbenchTerminalShellHeaderRow[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
}

interface ApiWorkbenchTerminalShellCopyPaneRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
  frame: WorkbenchFrame;
  rect: Rectangle;
  inspection: TerminalShellInspection;
  rows: WorkbenchTerminalCopyRowProjection[];
  theme: ApiWorkbenchThemeSpec;
  addHit: (rect: Rectangle, action: { type: "terminalShellCopyRow"; index: number }) => void;
}

interface ApiWorkbenchTerminalShellPanesRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
  frame: WorkbenchFrame;
  rect: Rectangle;
  inspection: TerminalShellWorkspaceInspection;
  activeShell?: TerminalShellController;
  shellForSession: (sessionId: string) => TerminalShellController | undefined;
  copyMode: boolean;
  rawInputActive: boolean;
  buffers: WorkbenchTerminalBufferCache;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, background: string) => void;
  addHit: (rect: Rectangle, action: TerminalShellViewHitAction) => void;
}

/** Renders the shell toolbar with shared button-row projection helpers. */
export function renderApiWorkbenchTerminalShellToolbar<
  Frame = WorkbenchFrame,
  HitType extends string = "terminalShell",
>(
  options: ApiWorkbenchTerminalShellToolbarRenderOptions<Frame, HitType>,
): number {
  const { frame, rect, startRow, state, buffers, theme, contrastText, paint, write, addHit } = options;
  const hitType = (options.hitType ?? "terminalShell") as HitType;
  workbenchTerminalToolbarItemsInto(buffers.items, state, options.actions ? { actions: options.actions } : undefined);
  return renderApiWorkbenchButtonRow({
    frame,
    rect,
    startRow,
    items: buffers.items,
    placements: buffers.placements,
    commands: buffers.commands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (action) => ({ type: hitType, action }),
  });
}

/** Renders the process-output terminal toolbar with shared button-row projection helpers. */
export function renderApiWorkbenchTerminalOutputToolbar(
  options: ApiWorkbenchTerminalOutputToolbarRenderOptions,
): number {
  const { frame, rect, startRow, state, buffers, theme, contrastText, paint, write, addHit } = options;
  workbenchTerminalOutputToolbarItemsInto(buffers.items, state);
  return renderApiWorkbenchButtonRow({
    frame,
    rect,
    startRow,
    items: buffers.items,
    placements: buffers.placements,
    commands: buffers.commands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (action) => ({ type: "terminalOutput" as const, action }),
  });
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

/** Renders the active shell status and hint rows above pane content. */
export function renderApiWorkbenchTerminalShellHeader(
  options: ApiWorkbenchTerminalShellHeaderRenderOptions,
): number {
  const { frame, rect, inspection, inputMode, copyMode, rows, theme, contrastText, fit, paint, write } = options;
  const statusTone = apiWorkbenchTerminalStatusToneColor(inspection.status, theme);
  const mode = copyMode ? "COPY MODE" : terminalInputModeDisplayLabel(inputMode, { rawLabel: "RAW SHELL" });
  const headerRows = workbenchTerminalShellHeaderRowsInto(rows, {
    status: {
      mode,
      status: inspection.status,
      pty: inspection.pty,
      backendLabel: inspection.backendLabel,
      commandLine: inspection.commandLine,
      scrollbackOffset: inspection.scrollback.offset,
      scrollbackViewportRows: inspection.scrollback.viewportRows,
      scrollbackTotalRows: inspection.scrollback.totalRows,
    },
    hint: { copyMode, inputMode },
  });

  let row = options.startRow;
  for (const header of headerRows) {
    const statusRow = header.kind === "status";
    write(
      frame,
      row,
      rect.column,
      paint(
        fit(header.text, rect.width),
        statusRow
          ? {
            fg: contrastText(statusTone, theme.background, theme.text),
            bg: statusTone,
            bold: true,
          }
          : { fg: theme.soft, bg: theme.panelSoft },
      ),
    );
    row += 1;
  }
  return row;
}

/** Renders copy-mode scrollback rows and row hit targets for the active shell pane. */
function renderApiWorkbenchTerminalShellCopyPane(
  options: ApiWorkbenchTerminalShellCopyPaneRenderOptions,
): void {
  const { frame, rect, inspection, rows: targetRows, theme, fit, paint, write, addHit } = options;
  const rows = workbenchTerminalCopyRowsInto(targetRows, {
    visibleRows: inspection.scrollback.visibleRows,
    offset: inspection.scrollback.offset,
    height: rect.height,
    selection: inspection.scrollback.selection,
    prefixWidth: 5,
  });
  for (const row of rows) {
    addHit({ column: rect.column, row: rect.row + row.screenRow, width: rect.width, height: 1 }, {
      type: "terminalShellCopyRow",
      index: row.rowIndex,
    });
    write(
      frame,
      rect.row + row.screenRow,
      rect.column,
      paint(fit(row.prefix, Math.min(5, rect.width)), {
        fg: row.selected ? theme.background : theme.soft,
        bg: row.selected ? theme.warn : theme.panelSoft,
        bold: row.selected,
      }),
    );
    if (rect.width > 5) {
      write(
        frame,
        rect.row + row.screenRow,
        rect.column + 5,
        paint(fit(row.text, rect.width - 5), {
          fg: row.selected ? theme.background : theme.text,
          bg: row.selected ? theme.warn : theme.surface,
          bold: row.selected,
        }),
      );
    }
  }
}

/** Renders all terminal workspace panes for the shell window. */
export function renderApiWorkbenchTerminalShellPanes(
  options: ApiWorkbenchTerminalShellPanesRenderOptions,
): void {
  const { frame, rect, inspection, buffers, theme, contrastText, fillRect, write, paint, addHit } = options;
  if (rect.width <= 0 || rect.height <= 0) return;
  const projections = workbenchTerminalPaneProjectionsInto(
    buffers.paneProjections,
    inspection.workspace.layout,
    rect,
    {
      gap: 1,
      fallbackSessionId: inspection.activeId,
      titleForSession: (sessionId) => inspection.sessions.find((entry) => entry.id === sessionId)?.title,
    },
  );
  const titleCommands = workbenchTerminalPaneTitleRenderCommandsInto(
    buffers.paneTitleCommands,
    projections,
    theme,
    contrastText,
  );
  let titleIndex = 0;
  for (const projection of projections) {
    const shell = projection.sessionId ? options.shellForSession(projection.sessionId) : options.activeShell;
    if (!shell) continue;
    const titleCommand = projection.titleVisible ? titleCommands[titleIndex++] : undefined;
    const paneRect = projection.rect;
    if (paneRect.width <= 0 || paneRect.height <= 0) continue;
    const active = projection.active;
    fillRect(frame, paneRect, active ? theme.surface : theme.background);
    const content = projection.contentRect;
    if (titleCommand) {
      write(frame, titleCommand.rect.row, titleCommand.rect.column, paint(titleCommand.text, titleCommand.style));
      if (titleCommand.paneId) {
        addHit(titleCommand.hitRect, { type: "terminalShellPane", id: titleCommand.paneId });
      }
    }
    if (content.width <= 0 || content.height <= 0) continue;
    shell.resize(content.width, content.height);
    if (active) addHit(content, { type: "terminalShellContent" });
    if (options.copyMode && active) {
      renderApiWorkbenchTerminalShellCopyPane({
        ...options,
        rect: content,
        inspection: shell.inspect(),
        rows: buffers.copyRows,
      });
      continue;
    }
    const cursor = shell.screen.cursor;
    const rows = shell.screen.cellRows();
    const cursorActive = options.rawInputActive && active && shell.running;
    for (let screenRow = 0; screenRow < content.height; screenRow += 1) {
      const cells = rows[screenRow] ?? [];
      for (let column = 0; column < content.width; column += 1) {
        const cell = cells[column] ?? { char: " " };
        const atCursor = cursorActive && cursor.row === screenRow && cursor.column === column;
        const style = apiWorkbenchTerminalCellStyle(cell, theme, atCursor);
        const char = atCursor && cell.char === " " ? " " : cell.char;
        write(frame, content.row + screenRow, content.column + column, paint(char, style));
      }
    }
  }
}

/** Renders the shell session tab strip while keeping terminal shell lifecycle state in the app. */
export function renderApiWorkbenchTerminalSessionTabs<
  Frame = WorkbenchFrame,
  HitType extends string = "terminalShellSession",
>(
  options: ApiWorkbenchTerminalSessionTabsRenderOptions<Frame, HitType>,
): number {
  const { frame, rect, startRow, inspection, buffers, theme, contrastText, paint, write, addHit } = options;
  if (startRow >= rect.row + rect.height) return startRow;
  const hitType = (options.hitType ?? "terminalShellSession") as HitType;

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
      addHit(command.rect, { type: hitType, id: command.id });
    }
  }
  return startRow + 1;
}
