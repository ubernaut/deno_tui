import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import { projectWorkbenchButtonCommand } from "../src/app/workbench_button_style.ts";
import type { WorkbenchButtonRowBufferCache } from "../src/app/workbench_buffers.ts";
import type {
  WorkbenchTerminalOutputToolbarAction,
  WorkbenchTerminalOutputToolbarState,
} from "../src/app/workbench_terminal.ts";
import { workbenchTerminalOutputToolbarItemsInto } from "../src/app/workbench_terminal.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

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
