import type { WorkbenchShelfBufferCache } from "../src/app/workbench_buffers.ts";
import type { WorkbenchButtonState, WorkbenchButtonTone } from "../src/app/workbench_button_style.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import {
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabsInto,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  type WorkbenchShelfWindowInspectionShape,
  workbenchTabEntriesInto,
} from "../src/app/workbench_shelf.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

interface ApiWorkbenchShelfRenderOptions<TId extends string, Frame = WorkbenchFrame> {
  frame: Frame;
  row: number;
  column: number;
  width: number;
  windows: readonly WorkbenchShelfWindowInspectionShape[];
  buffers: WorkbenchShelfBufferCache<TId>;
  theme: ApiWorkbenchThemeSpec;
  titleForId: (id: TId) => string;
  paint: (text: string, style: { fg?: string; bg?: string; bold?: boolean }) => string;
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
  paint: (text: string, style: { fg?: string; bg?: string; bold?: boolean }) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRow?: (frame: Frame, row: number, bg: string) => void;
  writeButton: ApiWorkbenchShelfRenderOptions<TId, Frame>["writeButton"];
  addHit: (rect: Rectangle, action: HitAction) => void;
  hitAction?: (id: TId) => HitAction;
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
