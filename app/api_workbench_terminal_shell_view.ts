import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import { projectWorkbenchButtonCommand } from "../src/app/workbench_button_style.ts";
import type { WorkbenchButtonRowBufferCache, WorkbenchTerminalBufferCache } from "../src/app/workbench_buffers.ts";
import type { WorkbenchFrame } from "../src/app/workbench/mod.ts";
import { type WorkbenchTerminalSessionTabBufferCache } from "../src/app/workbench_buffers.ts";
import {
  type WorkbenchTerminalCopyRowProjection,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalPaneProjection,
  workbenchTerminalPaneProjectionsInto,
  type WorkbenchTerminalPaneTitleRenderCommand,
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
import { terminalInputModeDisplayLabel } from "../src/runtime/terminal_status.ts";
import type { TerminalShellController, TerminalShellInspection } from "../src/runtime/terminal_shell.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";
import type { Rectangle } from "../src/types.ts";
import {
  apiWorkbenchTerminalCellStyle,
  apiWorkbenchTerminalStatusToneColor,
  type ApiWorkbenchThemeSpec,
} from "./api_workbench_catalog.ts";

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

export interface ApiWorkbenchTerminalShellToolbarRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  state: WorkbenchTerminalToolbarState;
  buffers: WorkbenchButtonRowBufferCache<WorkbenchTerminalToolbarAction>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: { type: "terminalShell"; action: WorkbenchTerminalToolbarAction }) => void;
}

export interface ApiWorkbenchTerminalShellHeaderRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
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

export interface ApiWorkbenchTerminalShellCopyPaneRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
  frame: WorkbenchFrame;
  rect: Rectangle;
  inspection: TerminalShellInspection;
  rows: WorkbenchTerminalCopyRowProjection[];
  theme: ApiWorkbenchThemeSpec;
  addHit: (rect: Rectangle, action: { type: "terminalShellCopyRow"; index: number }) => void;
}

export interface ApiWorkbenchTerminalShellScreenPaneRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  shell: TerminalShellController;
  active: boolean;
  cursorActive: boolean;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchTerminalShellPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
}

export interface ApiWorkbenchTerminalShellPaneRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
  frame: WorkbenchFrame;
  projection: WorkbenchTerminalPaneProjection;
  shell: TerminalShellController;
  copyMode: boolean;
  cursorActive: boolean;
  titleCommand?: WorkbenchTerminalPaneTitleRenderCommand;
  copyRows: WorkbenchTerminalCopyRowProjection[];
  theme: ApiWorkbenchThemeSpec;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, background: string) => void;
  addHit: (rect: Rectangle, action: TerminalShellViewHitAction) => void;
}

export interface ApiWorkbenchTerminalShellPanesRenderOptions extends ApiWorkbenchTerminalShellPaintCallbacks {
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
export function renderApiWorkbenchTerminalShellToolbar(
  options: ApiWorkbenchTerminalShellToolbarRenderOptions,
): number {
  const { frame, rect, startRow, state, buffers, theme, contrastText, paint, write, addHit } = options;
  workbenchTerminalToolbarItemsInto(buffers.items, state);
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
      addHit(button.hitRect, { type: "terminalShell", action: button.item.action });
    }
  }
  return nextRow;
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
export function renderApiWorkbenchTerminalShellCopyPane(
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

/** Renders the live terminal screen cells for a shell pane. */
export function renderApiWorkbenchTerminalShellScreenPane(
  options: ApiWorkbenchTerminalShellScreenPaneRenderOptions,
): void {
  const { frame, rect, shell, cursorActive, theme, paint, write } = options;
  shell.resize(rect.width, rect.height);
  const cursor = shell.screen.cursor;
  const rows = shell.screen.cellRows();
  for (let screenRow = 0; screenRow < rect.height; screenRow += 1) {
    const cells = rows[screenRow] ?? [];
    for (let column = 0; column < rect.width; column += 1) {
      const cell = cells[column] ?? { char: " " };
      const atCursor = cursorActive && cursor.row === screenRow && cursor.column === column;
      const style = apiWorkbenchTerminalCellStyle(cell, theme, atCursor);
      const char = atCursor && cell.char === " " ? " " : cell.char;
      write(frame, rect.row + screenRow, rect.column + column, paint(char, style));
    }
  }
}

/** Renders one terminal workspace pane, including its title, content hit target, and copy/live body. */
export function renderApiWorkbenchTerminalShellPane(
  options: ApiWorkbenchTerminalShellPaneRenderOptions,
): void {
  const { frame, projection, shell, copyMode, cursorActive, titleCommand, theme, fillRect, write, paint, addHit } =
    options;
  const rect = projection.rect;
  if (rect.width <= 0 || rect.height <= 0) return;
  const active = projection.active;
  fillRect(frame, rect, active ? theme.surface : theme.background);
  const content = projection.contentRect;
  if (titleCommand) {
    write(
      frame,
      titleCommand.rect.row,
      titleCommand.rect.column,
      paint(titleCommand.text, titleCommand.style),
    );
    if (titleCommand.paneId) {
      addHit(titleCommand.hitRect, {
        type: "terminalShellPane",
        id: titleCommand.paneId,
      });
    }
  }
  if (content.width <= 0 || content.height <= 0) return;
  shell.resize(content.width, content.height);
  if (active) addHit(content, { type: "terminalShellContent" });
  if (copyMode) {
    renderApiWorkbenchTerminalShellCopyPane({
      ...options,
      rect: content,
      inspection: shell.inspect(),
      rows: options.copyRows,
    });
    return;
  }
  renderApiWorkbenchTerminalShellScreenPane({
    frame,
    rect: content,
    shell,
    active,
    cursorActive,
    theme,
    paint,
    write,
  });
}

/** Renders all terminal workspace panes for the shell window. */
export function renderApiWorkbenchTerminalShellPanes(
  options: ApiWorkbenchTerminalShellPanesRenderOptions,
): void {
  const { rect, inspection, buffers, theme, contrastText } = options;
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
    renderApiWorkbenchTerminalShellPane({
      ...options,
      projection,
      shell,
      copyMode: options.copyMode && projection.active,
      cursorActive: options.rawInputActive && projection.active && shell.running,
      titleCommand,
      copyRows: buffers.copyRows,
    });
  }
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
