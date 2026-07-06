import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { ComputedLayoutBox } from "../src/layout/mod.ts";
import { createHtmlCssLayoutDemo } from "../src/markup/demo_fixtures.ts";
import type { Rectangle } from "../src/types.ts";
import {
  type HtmlCssLayoutRenderCommand,
  htmlCssLayoutRenderCommandsInto,
  htmlCssLayoutSummaryRows,
  type HtmlCssLayoutTheme,
  htmlCssVisibleLayoutBoxesInto,
} from "./html_css_layout_view.ts";

export interface ApiWorkbenchHtmlCssLayoutRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  boxes: ComputedLayoutBox[];
  commands: HtmlCssLayoutRenderCommand[];
  theme: HtmlCssLayoutTheme;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: { fg: string; bg: string; bold?: boolean }) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, bg: string) => void;
}

/** Renders the HTML/CSS layout demo in the terminal workbench using shared layout commands. */
export function renderApiWorkbenchHtmlCssLayout(
  options: ApiWorkbenchHtmlCssLayoutRenderOptions,
): void {
  const { frame, rect, boxes, commands, theme, contrastText, fit, paint, write, fillRect } = options;
  const result = createHtmlCssLayoutDemo(rect);
  const visibleBoxes = htmlCssVisibleLayoutBoxesInto(boxes, result.layout.boxes);
  const renderCommands = htmlCssLayoutRenderCommandsInto(commands, {
    bounds: rect,
    boxes: visibleBoxes,
    theme,
    contrast: contrastText,
    summaryRows: htmlCssLayoutSummaryRows("terminal"),
  });
  for (const command of renderCommands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, command.bg);
      continue;
    }
    write(
      frame,
      command.row,
      command.column,
      paint(fit(command.text, command.maxWidth), {
        fg: command.fg,
        bg: command.bg,
        bold: command.bold,
      }),
    );
  }
}
