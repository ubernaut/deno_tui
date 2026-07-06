import {
  projectWorkbenchButtonCommand,
  type WorkbenchButtonContrast,
  type WorkbenchButtonTheme,
} from "../src/app/workbench_button_style.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchButtonRowRenderCommand,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import type { Rectangle } from "../src/types.ts";

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
