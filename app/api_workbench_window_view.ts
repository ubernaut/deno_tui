import type { ScrollAreaController } from "../src/components/scroll_area.ts";
import {
  blitWorkbenchFrameCells,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
} from "../src/app/workbench_frame.ts";
import { workbenchContentViewport } from "../src/app/workbench_layout.ts";
import {
  type WorkbenchScrollbarAxis,
  type WorkbenchScrollbarRenderCommand,
  workbenchWindowScrollbarRenderCommandsInto,
} from "../src/app/workbench_layout.ts";
import { type WorkbenchButtonTone } from "../src/app/workbench_button_style.ts";
import { WorkbenchTitlebarBufferCache } from "../src/app/workbench_buffers.ts";
import {
  layoutWorkbenchTitlebarInto,
  type WorkbenchTitlebarButtonKind,
  workbenchTitlebarButtonRenderCommandsInto,
} from "../src/app/workbench_titlebar.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../src/app/workbench_frame_render.ts";
import { inset } from "../src/app/hit_targets.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

interface ApiWorkbenchWindowPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

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
