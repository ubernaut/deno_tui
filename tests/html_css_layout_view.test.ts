// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  htmlCssLayoutBoxPaintOrder,
  htmlCssLayoutBoxStyle,
  type HtmlCssLayoutRenderCommand,
  htmlCssLayoutRenderCommandsInto,
  htmlCssLayoutSummaryRows,
  type HtmlCssLayoutTheme,
  htmlCssVisibleLayoutBoxesInto,
} from "../app/html_css_layout_view.ts";

const theme: HtmlCssLayoutTheme = {
  accent: "#00ff99",
  accentDeep: "#006644",
  background: "#000000",
  border: "#333333",
  borderStrong: "#ffffff",
  buttonActiveBg: "#99ff00",
  buttonActiveText: "#101010",
  danger: "#ff3366",
  muted: "#888888",
  panel: "#151515",
  panelSoft: "#222222",
  soft: "#bbbbbb",
  surface: "#050505",
  text: "#eeeeee",
  warn: "#ffcc00",
};

const contrast = (color: string) => `contrast:${color}`;

Deno.test("htmlCssLayoutBoxStyle maps special layout boxes to theme-aware styles", () => {
  assertEquals(htmlCssLayoutBoxStyle({ id: "layout-toolbar" }, theme, contrast), {
    fg: "contrast:#006644",
    bg: theme.accentDeep,
    border: theme.accent,
    bold: true,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "layout-stage" }, theme, contrast), {
    fg: theme.text,
    bg: theme.panelSoft,
    border: theme.borderStrong,
    bold: true,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "layout-badge" }, theme, contrast), {
    fg: "contrast:#ffcc00",
    bg: theme.warn,
    border: theme.danger,
    bold: true,
  });
});

Deno.test("htmlCssLayoutBoxStyle groups grid and metric child boxes", () => {
  assertEquals(htmlCssLayoutBoxStyle({ id: "grid-shell" }, theme, contrast), {
    fg: theme.buttonActiveText,
    bg: theme.buttonActiveBg,
    border: theme.accent,
    bold: true,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "grid-worker" }, theme, contrast), {
    fg: "contrast:#ffcc00",
    bg: theme.warn,
    border: theme.danger,
    bold: true,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "grid-cache" }, theme, contrast), {
    fg: theme.text,
    bg: theme.panel,
    border: theme.accent,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "metric-cpu" }, theme, contrast), {
    fg: theme.buttonActiveText,
    bg: theme.buttonActiveBg,
    border: theme.accent,
    bold: true,
  });
  assertEquals(htmlCssLayoutBoxStyle({ id: "metric-memory" }, theme, contrast), {
    fg: theme.text,
    bg: theme.panel,
    border: theme.accent,
  });
});

Deno.test("htmlCssLayoutBoxPaintOrder keeps overlays above base panels", () => {
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "layout-demo" }), 0);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "layout-stage" }), 1);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "layout-grid" }), 2);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "metric-cpu" }), 2);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "grid-worker" }), 3);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "layout-badge" }), 4);
  assertEquals(htmlCssLayoutBoxPaintOrder({ id: "unknown" }), 2);
});

Deno.test("htmlCssVisibleLayoutBoxesInto filters hidden boxes and reuses caller storage", () => {
  const target = [{ id: "stale", visible: true, zIndex: 99 }];
  const result = htmlCssVisibleLayoutBoxesInto(target, [
    { id: "layout-badge", visible: true, zIndex: 1 },
    { id: "hidden", visible: false, zIndex: -1 },
    { id: "layout-demo", visible: true, zIndex: 0 },
    { id: "grid-worker", visible: true, zIndex: 1 },
    { id: "metric-cpu", visible: true, zIndex: 1 },
  ]);

  assertEquals(result, target);
  assertEquals(
    result.map((box) => box.id),
    ["layout-demo", "metric-cpu", "grid-worker", "layout-badge"],
  );
});

Deno.test("htmlCssLayoutSummaryRows exposes terminal and web host profiles", () => {
  const terminal = htmlCssLayoutSummaryRows("terminal");
  const web = htmlCssLayoutSummaryRows("web");

  assertEquals(terminal.length, 3);
  assertEquals(web.length, 3);
  assertEquals(terminal[0], web[0]);
  assertEquals(terminal[1]?.includes("Default solver"), true);
  assertEquals(web[2]?.includes("browser"), true);
});

Deno.test("htmlCssLayoutRenderCommandsInto projects boxes outlines labels and summaries", () => {
  const target: HtmlCssLayoutRenderCommand[] = [{
    kind: "fill",
    rect: { column: 9, row: 9, width: 1, height: 1 },
    bg: "stale",
  }];
  const commands = htmlCssLayoutRenderCommandsInto(target, {
    bounds: { column: 0, row: 0, width: 20, height: 8 },
    boxes: [
      {
        id: "metric-cpu",
        tag: "panel",
        classes: [],
        rect: { column: 1, row: 1, width: 10, height: 5 },
        contentRect: { column: 2, row: 2, width: 8, height: 3 },
        text: "CPU 42%",
        visible: true,
        zIndex: 0,
        children: [],
        styles: {},
      } as any,
    ],
    theme,
    contrast,
    summaryRows: ["pipeline", "resize"],
  });

  assertEquals(commands, target);
  assertEquals(commands[0], {
    kind: "fill",
    rect: { column: 1, row: 1, width: 10, height: 5 },
    bg: theme.buttonActiveBg,
  });
  assertEquals(
    commands.some((command) => command.kind === "text" && command.text === "primary @media width:16"),
    true,
  );
  assertEquals(commands.some((command) => command.kind === "text" && command.text === "CPU 42%"), true);
  assertEquals(commands.some((command) => command.kind === "text" && command.text === "10x5 content 8x3"), true);
  assertEquals(commands.at(-2), {
    kind: "text",
    row: 6,
    column: 0,
    text: "pipeline",
    maxWidth: 20,
    fg: theme.accent,
    bg: theme.panelSoft,
    bold: true,
  });
  assertEquals(commands.at(-1), {
    kind: "text",
    row: 7,
    column: 0,
    text: "resize",
    maxWidth: 20,
    fg: theme.soft,
    bg: theme.panelSoft,
    bold: false,
  });
});
