import type { ScrollAreaController } from "../src/components/scroll_area.ts";
import { renderMenuBar } from "../src/components/menu_bar.ts";
import { modalContentHeight, type ModalInspection } from "../src/components/modal.ts";
import type { TerminalOutputLine } from "../src/components/terminal_output.ts";
import {
  blitWorkbenchFrameCells,
  buttonText,
  fitCellText,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
} from "../src/app/workbench_frame.ts";
import type { WorkbenchAsciiConfigRow } from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionItemsInto,
  type WorkbenchAsciiConfigModalBufferCache,
  workbenchAsciiConfigRowPlacementsInto,
  workbenchAsciiConfigRowRenderCommandsInto,
} from "../src/app/workbench_ascii_modal.ts";
import { workbenchContentViewport } from "../src/app/workbench_layout.ts";
import {
  type WorkbenchScrollbarAxis,
  type WorkbenchScrollbarRenderCommand,
  workbenchWindowScrollbarRenderCommandsInto,
} from "../src/app/workbench_layout.ts";
import {
  layoutWorkbenchHeaderInto,
  layoutWorkbenchMenuBarHitsInto,
  type WorkbenchHeaderLayout,
  type WorkbenchMenuBarHitLayout,
  type WorkbenchMenuBarItemShape,
  type WorkbenchStandardTopMenuDropdownEntry,
  workbenchStandardTopMenuDropdownOverlayInto,
  type WorkbenchStandardTopMenuId,
} from "../src/app/workbench_menu.ts";
import {
  layoutWorkbenchModal,
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchDropdownOverlayRenderCommandsInto,
  workbenchModalActionButtonsInto,
  workbenchModalRowRenderCommandsInto,
} from "../src/app/workbench_overlay.ts";
import {
  workbenchHeaderHelp,
  type WorkbenchStatusShortcutProfile,
  workbenchStatusSnapshotLine,
} from "../src/app/workbench_status.ts";
import {
  projectWorkbenchButtonCommand,
  type WorkbenchButtonContrast,
  type WorkbenchButtonState,
  type WorkbenchButtonTheme,
  type WorkbenchButtonTone,
} from "../src/app/workbench_button_style.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchButtonRowRenderCommand,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import {
  type WorkbenchButtonRowBufferCache,
  type WorkbenchModalBufferCache,
  WorkbenchShelfBufferCache,
  type WorkbenchTerminalBufferCache,
  type WorkbenchTerminalSessionTabBufferCache,
  WorkbenchTitlebarBufferCache,
} from "../src/app/workbench_buffers.ts";
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
import {
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabsInto,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  type WorkbenchShelfWindowInspectionShape,
  workbenchTabEntriesInto,
} from "../src/app/workbench_shelf.ts";
import {
  layoutWorkbenchTitlebarInto,
  type WorkbenchTitlebarButtonKind,
  workbenchTitlebarButtonRenderCommandsInto,
} from "../src/app/workbench_titlebar.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../src/app/workbench_frame_render.ts";
import { inset, intersects } from "../src/app/hit_targets.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import type { TerminalShellController, TerminalShellInspection } from "../src/runtime/terminal_shell.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";
import {
  formatTerminalOutputHint,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
} from "../src/runtime/terminal_status.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import {
  apiWorkbenchTerminalCellStyle,
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
  type ApiWorkbenchThemeSpec,
} from "./api_workbench_catalog.ts";

interface ApiWorkbenchWindowPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

export interface ApiWorkbenchDropdownOverlay {
  kind: "control" | WorkbenchStandardTopMenuId;
  coordinate: "workspace" | "screen";
  rect: Rectangle;
  items: string[];
  itemIndexes?: number[];
  selectedIndex?: number;
}

type ApiWorkbenchChromeHeaderHitAction = { type: "menu"; index: number } | { type: "quit" };

type ApiWorkbenchDropdownOverlayHitAction =
  | { type: "theme"; index: number }
  | { type: "newWindow"; index: number }
  | { type: "workspace"; index: number }
  | { type: "control"; id: "dropdown"; action: "activate"; index: number };

export class ApiWorkbenchWindowShellBufferCache<TId extends string> {
  readonly titlebars = new WorkbenchTitlebarBufferCache<TId>();
  readonly frameBoxLines: WorkbenchFrameBoxLine[] = [];
  readonly frameCommands: WorkbenchFrameRenderCommand[] = [];
  readonly scrollbarCommands: WorkbenchScrollbarRenderCommand[] = [];
}

interface ApiWorkbenchWindowContentContext {
  viewport: Rectangle;
  offset: { columns: number; rows: number };
}

interface ApiWorkbenchWindowContentRenderedContext extends ApiWorkbenchWindowContentContext {
  contentHitStart: number;
}

interface ApiWorkbenchChromeHeaderRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  width: number;
  menuItems: readonly WorkbenchMenuBarItemShape[];
  menuActiveIndex: number;
  openMenuId: WorkbenchStandardTopMenuId | null;
  dropdownEntries: Partial<Record<WorkbenchStandardTopMenuId, WorkbenchStandardTopMenuDropdownEntry>>;
  titleColumn?: number;
  closeMinWidth?: number;
  reserveCloseWhenHidden?: boolean;
  showHelp?: boolean;
  headerLayout: WorkbenchHeaderLayout;
  menuHitLayouts: WorkbenchMenuBarHitLayout[];
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRow: (frame: Frame, row: number, background: string) => void;
  writeButton: (
    frame: Frame,
    row: number,
    column: number,
    label: string,
    options?: { compact?: boolean; tone?: "danger" },
  ) => number;
  addHit: (rect: Rectangle, action: ApiWorkbenchChromeHeaderHitAction) => void;
}

interface ApiWorkbenchStatusRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  row: number;
  width: number;
  focus: string;
  themeLabel: string;
  tileDensity: number;
  diagnostics: string;
  shortcutProfile?: WorkbenchStatusShortcutProfile;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
}

interface ApiWorkbenchDropdownOverlayRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  overlay: ApiWorkbenchDropdownOverlay | null;
  workspaceBounds: Rectangle;
  screenBounds: Rectangle;
  workspaceOffsetRows: number;
  commands: WorkbenchDropdownOverlayRenderCommand[];
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRect: (frame: Frame, rect: Rectangle, background: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchDropdownOverlayHitAction) => void;
}

interface ApiWorkbenchShelfRenderOptions<TId extends string, Frame = WorkbenchFrame> {
  frame: Frame;
  row: number;
  column: number;
  width: number;
  windows: readonly WorkbenchShelfWindowInspectionShape[];
  buffers: WorkbenchShelfBufferCache<TId>;
  theme: ApiWorkbenchThemeSpec;
  titleForId: (id: TId) => string;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  writeButton: (
    frame: Frame,
    row: number,
    column: number,
    label: string,
    options?: {
      state?: WorkbenchButtonState;
      tone?: WorkbenchButtonTone;
      compact?: boolean;
      maxWidth?: number;
    },
  ) => number;
  addHit: (rect: Rectangle, action: { type: "restore"; id: TId }) => void;
}

interface ApiWorkbenchWindowTabsRenderOptions<
  TId extends string,
  Frame = WorkbenchFrame,
  HitAction = { type: "windowTab"; id: TId },
> {
  frame: Frame;
  row: number;
  column: number;
  width: number;
  tabs: readonly WorkbenchShelfWindowInspectionShape[];
  buffers: WorkbenchShelfBufferCache<TId>;
  theme: ApiWorkbenchThemeSpec;
  titleForId: (id: TId) => string;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRow?: (frame: Frame, row: number, bg: string) => void;
  writeButton: ApiWorkbenchShelfRenderOptions<TId, Frame>["writeButton"];
  addHit: (rect: Rectangle, action: HitAction) => void;
  hitAction?: (id: TId) => HitAction;
}

interface ApiWorkbenchWindowFrameRenderOptions<TId extends string = string> {
  frame: WorkbenchFrame;
  rect: Rectangle;
  title: string;
  active: boolean;
  theme: ApiWorkbenchThemeSpec;
  buffers: ApiWorkbenchWindowShellBufferCache<TId>;
  paint: (text: string, options: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, bg: string) => void;
}

interface ApiWorkbenchWindowShellRenderOptions<TId extends string, TAction> {
  frame: WorkbenchFrame;
  id: TId;
  rect: Rectangle;
  minimized: boolean;
  active: boolean;
  title: string;
  showConfig: boolean;
  theme: ApiWorkbenchThemeSpec;
  buffers: ApiWorkbenchWindowShellBufferCache<TId>;
  scroll: ScrollAreaController;
  contentSizeForInner: (inner: Rectangle) => { width: number; height: number };
  contentFrameForRows: (rows: number) => WorkbenchFrame;
  setFrameWidthHint: (frame: WorkbenchFrame, width: number) => void;
  hitTargetCount: () => number;
  renderContent: (frame: WorkbenchFrame, rect: Rectangle, context: ApiWorkbenchWindowContentContext) => void;
  afterRenderContent: (context: ApiWorkbenchWindowContentRenderedContext) => void;
  focusAction: (id: TId) => TAction;
  titlebarAction: (id: TId, kind: WorkbenchTitlebarButtonKind) => TAction;
  scrollbarAction: (id: TId, axis: WorkbenchScrollbarAxis) => TAction;
  paint: (text: string, options: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, bg: string) => void;
  writeButton: (
    frame: WorkbenchFrame,
    row: number,
    column: number,
    label: string,
    options?: { compact?: boolean; tone?: WorkbenchButtonTone },
  ) => number;
  addHit: (rect: Rectangle, action: TAction) => void;
}

interface ApiWorkbenchModalRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  bounds: Rectangle;
  inspection: ModalInspection;
  buffers: WorkbenchModalBufferCache<number>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRect: (frame: Frame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: Frame, rect: Rectangle, title: string, active: boolean) => void;
  maxWidth?: number;
  addHit: (rect: Rectangle, action: { type: "modalAction"; index: number }) => void;
}

interface ApiWorkbenchThreeConfigModalRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  bounds: Rectangle;
  rows: readonly WorkbenchAsciiConfigRow[];
  selectedIndex: number;
  title: string;
  frameTitle?: string;
  titleStyle?: ApiWorkbenchWindowPaintStyle;
  helpText?: string;
  footerText?: string;
  footerStyle?: ApiWorkbenchWindowPaintStyle;
  rowSplitMinWidth?: number;
  activateRowHits?: boolean;
  buffers: WorkbenchAsciiConfigModalBufferCache<WorkbenchAsciiConfigRow>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchWindowPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRect: (frame: Frame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: Frame, rect: Rectangle, title: string, active: boolean) => void;
  rowText: (row: WorkbenchAsciiConfigRow, layout: { inner: Rectangle }) => string;
  rowStyle?: (selected: boolean, theme: ApiWorkbenchThemeSpec) => ApiWorkbenchWindowPaintStyle;
  addHit: (
    rect: Rectangle,
    action:
      | { type: "asciiConfigBackdrop" }
      | { type: "asciiConfig"; index: number; action?: "previous" | "next" | "activate" }
      | { type: "asciiConfigAction"; action: WorkbenchAsciiConfigModalAction },
  ) => void;
}

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

export function renderApiWorkbenchButtonRow<Frame, Action, HitAction>(
  options: {
    frame: Frame;
    rect: Rectangle;
    startRow: number;
    items: readonly WorkbenchButtonRowItem<Action>[];
    placements: WorkbenchButtonRowPlacement<Action>[];
    commands: WorkbenchButtonRowRenderCommand<Action>[];
    theme: WorkbenchButtonTheme;
    contrastText: WorkbenchButtonContrast;
    paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
    write: (frame: Frame, row: number, column: number, value: string) => void;
    addHit: (rect: Rectangle, action: HitAction) => void;
    hitAction: (action: Action) => HitAction;
  },
): number {
  const { frame, rect, startRow, items, placements, commands, theme, contrastText, paint, write, addHit, hitAction } =
    options;
  const nextRow = layoutWorkbenchButtonRowInto(placements, items, rect, startRow);
  workbenchButtonRowRenderCommandsInto(commands, placements);
  for (const command of commands) {
    const projection = projectWorkbenchButtonCommand(command, theme, contrastText);
    write(frame, command.rect.row, command.rect.column, paint(projection.text, projection.style));
    if (!command.item.disabled) addHit(command.hitRect, hitAction(command.item.action));
  }
  return nextRow;
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

/** Renders a generic API Workbench modal overlay from renderer-neutral modal inspection data. */
export function renderApiWorkbenchModalOverlay<Frame = WorkbenchFrame>(
  options: ApiWorkbenchModalRenderOptions<Frame>,
): void {
  const { frame, bounds, inspection, buffers, theme, contrastText, fit, paint, write, fillRect, drawFrame, addHit } =
    options;
  addHit(bounds, { type: "modalAction", index: -1 });

  const maxWidth = Math.max(38, Math.floor(options.maxWidth ?? 72));
  const probeWidth = Math.min(Math.max(38, bounds.width - 8), maxWidth);
  const { rect, inner, shadow } = layoutWorkbenchModal({
    bounds,
    contentHeight: modalContentHeight(inspection, probeWidth),
    maxWidth,
  });
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, theme.background);

  fillRect(frame, rect, theme.panelSoft);
  drawFrame(frame, rect, inspection.title, true);

  const rowCommands = workbenchModalRowRenderCommandsInto(buffers.rowCommands, {
    inspection,
    inner,
    contentWidth: rect.width,
  });
  let actionRow: number | undefined;
  for (const command of rowCommands) {
    if (command.kind === "actions") actionRow = command.rect.row;
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(fit(command.text, command.rect.width), {
        fg: command.kind === "title" ? theme.accent : theme.text,
        bg: command.kind === "actions" ? theme.panel : theme.panelSoft,
        bold: command.kind === "actions" || command.kind === "title",
      }),
    );
  }

  if (inspection.actions.length === 0 || actionRow === undefined) return;
  workbenchModalActionButtonsInto(buffers.actionItems, inspection);
  renderApiWorkbenchButtonRow({
    frame,
    rect: { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    startRow: actionRow,
    items: buffers.actionItems,
    placements: buffers.actionPlacements,
    commands: buffers.actionCommands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (index) => ({ type: "modalAction" as const, index }),
  });
}

/** Renders the Three ASCII configuration modal while keeping state mutation in the host workbench. */
export function renderApiWorkbenchThreeConfigModal<Frame = WorkbenchFrame>(
  options: ApiWorkbenchThreeConfigModalRenderOptions<Frame>,
): void {
  const {
    frame,
    bounds,
    rows,
    selectedIndex,
    title,
    buffers,
    theme,
    contrastText,
    fit,
    paint,
    write,
    fillRect,
    drawFrame,
    rowText,
    addHit,
  } = options;
  addHit(bounds, { type: "asciiConfigBackdrop" });
  const layout = layoutWorkbenchAsciiConfigModal({ bounds, rowCount: rows.length });
  if (layout.shadow.width > 0 && layout.shadow.height > 0) fillRect(frame, layout.shadow, theme.background);
  fillRect(frame, layout.rect, theme.panelSoft);
  drawFrame(frame, layout.rect, options.frameTitle ?? "Three Renderer Config", true);

  const inner = layout.inner;
  write(
    frame,
    inner.row,
    inner.column,
    paint(
      fit(title, inner.width),
      options.titleStyle ?? {
        fg: theme.accent,
        bg: theme.panelSoft,
        bold: true,
      },
    ),
  );
  if (options.helpText) {
    write(
      frame,
      inner.row + 1,
      inner.column,
      paint(fit(options.helpText, inner.width), {
        fg: theme.muted,
        bg: theme.panelSoft,
      }),
    );
  }
  const placements = workbenchAsciiConfigRowPlacementsInto(buffers.rowPlacements, rows, {
    inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex,
    splitMinWidth: options.rowSplitMinWidth ?? 6,
  });
  const rowCommands = workbenchAsciiConfigRowRenderCommandsInto(buffers.rowRenderCommands, placements, {
    text: (row) => rowText(row, { inner }),
  });
  for (const command of rowCommands) {
    const selected = command.selected;
    const style = options.rowStyle?.(selected, theme) ?? {
      fg: selected ? theme.background : theme.text,
      bg: selected ? theme.warn : theme.surface,
      bold: selected,
    };
    const text = command.kind === "fill" ? " ".repeat(command.rect.width) : fit(command.text, command.rect.width);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(text, { ...style, bold: command.kind === "text" && style.bold }),
    );
  }
  for (const placement of placements) {
    if (options.activateRowHits) {
      addHit(placement.rect, {
        type: "asciiConfig",
        index: placement.rowIndex,
        action: "activate",
      });
    }
    addHit(placement.previousRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "previous",
    });
    addHit(placement.nextRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "next",
    });
  }
  workbenchAsciiConfigModalActionItemsInto(buffers.actionItems);
  renderApiWorkbenchButtonRow({
    frame,
    rect: { column: inner.column, row: layout.actionRow, width: inner.width, height: 1 },
    startRow: layout.actionRow,
    items: buffers.actionItems,
    placements: buffers.actionPlacements,
    commands: buffers.actionCommands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (action) => ({ type: "asciiConfigAction" as const, action }),
  });
  const footer = options.footerText ?? "Up/Down select  Left/Right change  Enter toggle  A apply  O OK  Esc cancel";
  write(
    frame,
    layout.footerRow,
    inner.column,
    paint(
      fit(footer, inner.width),
      options.footerStyle ?? {
        fg: theme.muted,
        bg: theme.panel,
      },
    ),
  );
}

/** Renders the top workbench chrome and returns the active top-menu overlay, if any. */
export function renderApiWorkbenchChromeHeader<Frame = WorkbenchFrame>(
  options: ApiWorkbenchChromeHeaderRenderOptions<Frame>,
): ApiWorkbenchDropdownOverlay | null {
  const {
    frame,
    width,
    menuItems,
    menuActiveIndex,
    openMenuId,
    dropdownEntries,
    headerLayout,
    menuHitLayouts,
    theme,
    paint,
    write,
    fillRow,
    writeButton,
    addHit,
  } = options;
  fillRow(frame, 0, theme.backgroundSoft);
  fillRow(frame, 1, theme.panel);
  write(
    frame,
    0,
    options.titleColumn ?? 0,
    paint(" API WORKBENCH ", { fg: theme.background, bg: theme.accent, bold: true }),
  );

  const closeLabel = width >= 20 || options.reserveCloseWhenHidden ? buttonText("x", { compact: true }) : "";
  const closeWidth = textWidth(closeLabel);
  const header = layoutWorkbenchHeaderInto(headerLayout, {
    width,
    menuStart: 17,
    closeWidth,
    closeMinWidth: options.closeMinWidth ?? 20,
    reserveCloseWhenHidden: options.reserveCloseWhenHidden,
  });
  const hits = layoutWorkbenchMenuBarHitsInto(menuHitLayouts, {
    column: header.menu.column,
    row: header.menu.row,
    width: header.menu.width,
    items: menuItems,
    activeIndex: menuActiveIndex,
    measureText: textWidth,
  });
  for (const hit of hits) {
    addHit(hit.rect, { type: "menu", index: hit.index });
  }

  write(
    frame,
    header.menu.row,
    header.menu.column,
    paint(fitCellText(renderMenuBar(menuItems, menuActiveIndex), header.menu.width), {
      fg: theme.text,
      bg: theme.backgroundSoft,
    }),
  );
  if (header.close) {
    writeButton(frame, header.close.row, header.close.column, "x", { compact: true, tone: "danger" });
    addHit(header.close, { type: "quit" });
  }

  const overlay = workbenchStandardTopMenuDropdownOverlayInto({
    openId: openMenuId,
    menuStart: header.menu.column,
    menuItems,
    menuActiveIndex,
    maxWidth: width,
    entries: dropdownEntries,
    measureText: textWidth,
  });
  const help = options.showHelp === false ? "" : workbenchHeaderHelp({ width });
  const helpWidth = textWidth(help);
  const showHelp = help.length > 0;
  const helpStart = showHelp ? Math.max(0, width - helpWidth) : width;
  if (showHelp) {
    write(
      frame,
      1,
      helpStart,
      paint(help, {
        fg: theme.muted,
        bg: theme.panel,
      }),
    );
  }
  return overlay;
}

/** Renders the bottom status line for the current workbench snapshot. */
export function renderApiWorkbenchStatus<Frame = WorkbenchFrame>(
  options: ApiWorkbenchStatusRenderOptions<Frame>,
): void {
  const { frame, row, width, focus, themeLabel, tileDensity, diagnostics, theme, paint, write } = options;
  const line = workbenchStatusSnapshotLine({
    snapshot: {
      focus,
      theme: themeLabel,
      tileDensity,
      diagnostics,
    },
    width,
    shortcutProfile: options.shortcutProfile,
  });
  write(frame, row, 0, paint(line, { fg: theme.text, bg: theme.panelSoft }));
}

/** Renders the active top-menu or control dropdown overlay and registers item hits. */
export function renderApiWorkbenchDropdownOverlay<Frame = WorkbenchFrame>(
  options: ApiWorkbenchDropdownOverlayRenderOptions<Frame>,
): void {
  const {
    frame,
    overlay,
    workspaceBounds,
    screenBounds,
    workspaceOffsetRows,
    commands,
    theme,
    paint,
    write,
    fillRect,
  } = options;
  if (!overlay || overlay.items.length === 0) return;

  const clip = overlay.coordinate === "workspace" ? workspaceBounds : screenBounds;
  const rect = overlay.coordinate === "workspace"
    ? { ...overlay.rect, row: overlay.rect.row + workspaceBounds.row - workspaceOffsetRows }
    : overlay.rect;
  if (!intersects(rect, clip)) return;

  const renderedCommands = workbenchDropdownOverlayRenderCommandsInto(commands, {
    rect,
    bounds: clip,
    items: overlay.items,
    itemIndexes: overlay.itemIndexes,
    selectedIndex: overlay.selectedIndex,
  });
  for (const command of renderedCommands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, theme.panelSoft);
      continue;
    }
    const style = command.selected
      ? { fg: theme.background, bg: theme.warn, bold: true }
      : command.kind === "item"
      ? { fg: theme.text, bg: theme.panelSoft, bold: false }
      : { fg: theme.accent, bg: theme.panelSoft, bold: true };
    write(frame, command.rect.row, command.rect.column, paint(command.text ?? "", style));
    if (command.kind === "item" && command.hitRect && command.hitRect.width > 0 && command.hitRect.height > 0) {
      const index = command.itemIndex ?? command.sourceIndex ?? 0;
      const action: ApiWorkbenchDropdownOverlayHitAction = overlay.kind === "control"
        ? { type: "control", id: "dropdown", action: "activate", index }
        : { type: overlay.kind, index };
      options.addHit(command.hitRect, action);
    }
  }
}

/** Renders the minimized-window shelf while keeping app-specific window state outside the shared layout module. */
export function renderApiWorkbenchShelf<TId extends string, Frame = WorkbenchFrame>(
  options: ApiWorkbenchShelfRenderOptions<TId, Frame>,
): void {
  const { frame, row, column, width, windows, buffers, theme, titleForId, paint, write, writeButton, addHit } = options;
  const entries = workbenchShelfEntriesInto(buffers.entries, windows, titleForId);
  if (entries.length === 0) return;

  const layout = layoutWorkbenchShelfInto(buffers.shelfLayout, {
    row,
    column,
    width,
    entries,
  });
  const commands = workbenchShelfRenderCommandsInto(buffers.shelfCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(
        frame,
        command.rect.row,
        command.rect.column,
        paint(command.text, { fg: theme.muted, bg: theme.backgroundSoft }),
      );
      continue;
    }
    writeButton(frame, command.rect.row, command.rect.column, command.label, {
      state: command.state,
      tone: command.tone,
      maxWidth: command.rect.width,
    });
    addHit(command.hitRect, { type: "restore", id: command.id });
  }
}

/** Renders the fullscreen window tab strip shown while one window owns the workspace. */
export function renderApiWorkbenchWindowTabs<
  TId extends string,
  Frame = WorkbenchFrame,
  HitAction = { type: "windowTab"; id: TId },
>(
  options: ApiWorkbenchWindowTabsRenderOptions<TId, Frame, HitAction>,
): void {
  const { frame, row, column, width, tabs, buffers, theme, titleForId, paint, write, fillRow, writeButton, addHit } =
    options;
  fillRow?.(frame, row, theme.backgroundSoft);
  const layout = layoutWorkbenchTabsInto(buffers.tabLayout, {
    row,
    column,
    width,
    tabs: workbenchTabEntriesInto(buffers.tabs, tabs, titleForId),
  });
  const commands = workbenchShelfRenderCommandsInto(buffers.tabCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(
        frame,
        command.rect.row,
        command.rect.column,
        paint(command.text, { fg: theme.muted, bg: theme.backgroundSoft }),
      );
      continue;
    }
    writeButton(frame, command.rect.row, command.rect.column, command.label, {
      state: command.state,
      tone: command.tone,
      maxWidth: command.rect.width,
    });
    addHit(command.hitRect, options.hitAction?.(command.id) ?? ({ type: "windowTab", id: command.id } as HitAction));
  }
}

/** Renders a workbench window shell, then delegates the scrollable content body to the caller. */
export function renderApiWorkbenchWindowShell<TId extends string, TAction>(
  options: ApiWorkbenchWindowShellRenderOptions<TId, TAction>,
): boolean {
  const {
    frame,
    id,
    rect,
    minimized,
    active,
    title,
    showConfig,
    theme,
    buffers,
    scroll,
    paint,
    write,
    fillRect,
    writeButton,
    addHit,
  } = options;
  if (rect.width < 8 || rect.height < 4 || minimized) return false;

  addHit(rect, options.focusAction(id));
  renderApiWorkbenchWindowFrame({ frame, rect, title, active, theme, buffers, paint, write, fillRect });
  renderApiWorkbenchWindowTitlebar({
    frame,
    id,
    rect,
    title,
    showConfig,
    buffers: buffers.titlebars,
    writeButton,
    addHit,
    titlebarAction: options.titlebarAction,
  });

  const inner = inset(rect, 1);
  const contentSize = options.contentSizeForInner(inner);
  const viewport = workbenchContentViewport({
    inner,
    contentWidth: contentSize.width,
    contentHeight: contentSize.height,
  });
  scroll.setViewportSize(viewport.width, viewport.height);
  scroll.setContentSize(contentSize.width, contentSize.height);

  fillRect(frame, inner, theme.surface);
  const contentFrame = options.contentFrameForRows(contentSize.height);
  options.setFrameWidthHint(contentFrame, contentSize.width);
  fillRect(contentFrame, { column: 0, row: 0, width: contentSize.width, height: contentSize.height }, theme.surface);

  const offset = scroll.offset.peek();
  const contentHitStart = options.hitTargetCount();
  options.renderContent(contentFrame, { column: 0, row: 0, width: contentSize.width, height: contentSize.height }, {
    viewport,
    offset,
  });
  options.afterRenderContent({ viewport, offset, contentHitStart });
  blitWorkbenchFrameCells(frame, contentFrame, viewport, offset);
  renderApiWorkbenchWindowScrollbars({
    frame,
    id,
    inner,
    viewport,
    scroll,
    theme,
    buffers,
    paint,
    write,
    addHit,
    scrollbarAction: options.scrollbarAction,
  });
  return true;
}

export function renderApiWorkbenchWindowTitlebar<TId extends string, TAction, Frame = WorkbenchFrame>(
  options: {
    frame: Frame;
    id: TId;
    rect: Rectangle;
    title: string;
    showConfig: boolean;
    buffers: WorkbenchTitlebarBufferCache<TId>;
    writeButton: (
      frame: Frame,
      row: number,
      column: number,
      label: string,
      options?: { compact?: boolean; tone?: WorkbenchButtonTone },
    ) => number;
    addHit: (rect: Rectangle, action: TAction) => void;
    titlebarAction: (id: TId, kind: WorkbenchTitlebarButtonKind) => TAction;
  },
): void {
  const titlebar = layoutWorkbenchTitlebarInto(options.buffers.layout(options.id), {
    rect: options.rect,
    title: options.title,
    showConfig: options.showConfig,
  });
  const commands = workbenchTitlebarButtonRenderCommandsInto(options.buffers.renderCommands(options.id), titlebar);
  for (const command of commands) {
    options.writeButton(options.frame, command.rect.row, command.rect.column, command.label, {
      compact: command.compact,
      tone: command.tone,
    });
    options.addHit(command.hitRect, options.titlebarAction(options.id, command.kind));
  }
}

export function renderApiWorkbenchWindowFrame<TId extends string = string>(
  options: ApiWorkbenchWindowFrameRenderOptions<TId>,
): void {
  const commands = workbenchFrameRenderCommandsInto(options.buffers.frameCommands, options.buffers.frameBoxLines, {
    rect: options.rect,
    title: options.title,
    active: options.active,
    theme: options.theme,
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      options.fillRect(options.frame, command.rect, command.bg);
    } else {
      options.write(options.frame, command.row, command.column, options.paint(command.text, command.style));
    }
  }
}

function renderApiWorkbenchWindowScrollbars<TId extends string, TAction>(
  options:
    & Pick<
      ApiWorkbenchWindowShellRenderOptions<TId, TAction>,
      "frame" | "id" | "theme" | "buffers" | "paint" | "write" | "addHit" | "scrollbarAction"
    >
    & {
      inner: Rectangle;
      viewport: Rectangle;
      scroll: ScrollAreaController;
    },
): void {
  const overflow = options.scroll.inspectOverflow();
  const commands = workbenchWindowScrollbarRenderCommandsInto(options.buffers.scrollbarCommands, {
    inner: options.inner,
    viewport: options.viewport,
    overflow,
  });
  for (const command of commands) {
    options.addHit(command.rect, options.scrollbarAction(options.id, command.axis));
    for (const cell of command.cells) {
      options.write(
        options.frame,
        cell.row,
        cell.column,
        options.paint(cell.glyph, { fg: options.theme.accent, bg: options.theme.panelSoft, bold: true }),
      );
    }
  }
}
