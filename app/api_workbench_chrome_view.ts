import { renderMenuBar } from "../src/components/menu_bar.ts";
import { buttonText, fitCellText } from "../src/app/workbench_frame.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
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
import { workbenchHeaderHelp, workbenchStatusSnapshotLine } from "../src/app/workbench_status.ts";
import { intersects } from "../src/app/hit_targets.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

interface ApiWorkbenchPaintStyle {
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

export type ApiWorkbenchChromeHeaderHitAction = { type: "menu"; index: number } | { type: "quit" };

export type ApiWorkbenchDropdownOverlayHitAction =
  | { type: "theme"; index: number }
  | { type: "newWindow"; index: number }
  | { type: "workspace"; index: number }
  | { type: "control"; id: "dropdown"; action: "activate"; index: number };

export interface ApiWorkbenchChromeHeaderRenderOptions {
  frame: WorkbenchFrame;
  width: number;
  menuItems: readonly WorkbenchMenuBarItemShape[];
  menuActiveIndex: number;
  openMenuId: WorkbenchStandardTopMenuId | null;
  dropdownEntries: Partial<Record<WorkbenchStandardTopMenuId, WorkbenchStandardTopMenuDropdownEntry>>;
  headerLayout: WorkbenchHeaderLayout;
  menuHitLayouts: WorkbenchMenuBarHitLayout[];
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRow: (frame: WorkbenchFrame, row: number, background: string) => void;
  writeButton: (
    frame: WorkbenchFrame,
    row: number,
    column: number,
    label: string,
    options?: { compact?: boolean; tone?: "danger" },
  ) => number;
  addHit: (rect: Rectangle, action: ApiWorkbenchChromeHeaderHitAction) => void;
}

export interface ApiWorkbenchStatusRenderOptions {
  frame: WorkbenchFrame;
  row: number;
  width: number;
  focus: string;
  themeLabel: string;
  tileDensity: number;
  diagnostics: string;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
}

export interface ApiWorkbenchDropdownOverlayRenderOptions {
  frame: WorkbenchFrame;
  overlay: ApiWorkbenchDropdownOverlay | null;
  workspaceBounds: Rectangle;
  screenBounds: Rectangle;
  workspaceOffsetRows: number;
  commands: WorkbenchDropdownOverlayRenderCommand[];
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, background: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchDropdownOverlayHitAction) => void;
}

/** Renders the top workbench chrome and returns the active top-menu overlay, if any. */
export function renderApiWorkbenchChromeHeader(
  options: ApiWorkbenchChromeHeaderRenderOptions,
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
  write(frame, 0, 0, paint(" API WORKBENCH ", { fg: theme.background, bg: theme.accent, bold: true }));

  const closeLabel = width >= 20 ? buttonText("x", { compact: true }) : "";
  const closeWidth = textWidth(closeLabel);
  const header = layoutWorkbenchHeaderInto(headerLayout, { width, menuStart: 17, closeWidth, closeMinWidth: 20 });
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
  const help = workbenchHeaderHelp({ width });
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
export function renderApiWorkbenchStatus(options: ApiWorkbenchStatusRenderOptions): void {
  const { frame, row, width, focus, themeLabel, tileDensity, diagnostics, theme, paint, write } = options;
  const line = workbenchStatusSnapshotLine({
    snapshot: {
      focus,
      theme: themeLabel,
      tileDensity,
      diagnostics,
    },
    width,
  });
  write(frame, row, 0, paint(line, { fg: theme.text, bg: theme.panelSoft }));
}

/** Renders the active top-menu or control dropdown overlay and registers item hits. */
export function renderApiWorkbenchDropdownOverlay(options: ApiWorkbenchDropdownOverlayRenderOptions): void {
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
      options.addHit(command.hitRect, dropdownHitAction(overlay, command.itemIndex ?? command.sourceIndex ?? 0));
    }
  }
}

function dropdownHitAction(
  overlay: ApiWorkbenchDropdownOverlay,
  index: number,
): ApiWorkbenchDropdownOverlayHitAction {
  return overlay.kind === "theme"
    ? { type: "theme", index }
    : overlay.kind === "newWindow"
    ? { type: "newWindow", index }
    : overlay.kind === "workspace"
    ? { type: "workspace", index }
    : { type: "control", id: "dropdown", action: "activate", index };
}
