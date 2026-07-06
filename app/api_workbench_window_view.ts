import type { ScrollAreaController } from "../src/components/scroll_area.ts";
import { renderMenuBar } from "../src/components/menu_bar.ts";
import {
  blitWorkbenchFrameCells,
  buttonText,
  fitCellText,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
} from "../src/app/workbench_frame.ts";
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
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchDropdownOverlayRenderCommandsInto,
} from "../src/app/workbench_overlay.ts";
import {
  workbenchHeaderHelp,
  type WorkbenchStatusShortcutProfile,
  workbenchStatusSnapshotLine,
} from "../src/app/workbench_status.ts";
import { type WorkbenchButtonState, type WorkbenchButtonTone } from "../src/app/workbench_button_style.ts";
import { WorkbenchShelfBufferCache, WorkbenchTitlebarBufferCache } from "../src/app/workbench_buffers.ts";
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
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

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
