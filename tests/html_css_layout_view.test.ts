// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  htmlCssLayoutBoxPaintOrder,
  htmlCssLayoutBoxStyle,
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
