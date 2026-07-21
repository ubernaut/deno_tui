import { assert, assertEquals } from "./deps.ts";
import {
  applyLayoutDeclaration,
  cellLength,
  createMarkupLayout,
  defaultComputedLayoutStyle,
  inspectLayoutDeclarationCompatibility,
  inspectLayoutSolverCapabilities,
  parseLayoutLength,
  SIMPLE_LAYOUT_SOLVER_CAPABILITIES,
  YOGA_LAYOUT_SOLVER_CAPABILITIES,
} from "../mod.ts";

Deno.test("L1 sizing normalizes advanced box values and fails closed atomically", () => {
  let style = defaultComputedLayoutStyle();
  style = applyLayoutDeclaration(style, "aspect-ratio", "16 / 9");
  style = applyLayoutDeclaration(style, "box-sizing", "border-box");
  style = applyLayoutDeclaration(style, "margin", "auto 10% 2 5%");
  style = applyLayoutDeclaration(style, "padding", "10% 5%");
  style = applyLayoutDeclaration(style, "gap", "20% 10%");

  assertEquals(style.aspectRatio, 16 / 9);
  assertEquals(style.boxSizing, "border-box");
  assertEquals(style.margin, { top: 0, right: 0, bottom: 2, left: 0 });
  assertEquals(style.padding, { top: 0, right: 0, bottom: 0, left: 0 });
  assertEquals([style.gap, style.rowGap, style.columnGap], [0, 0, 0]);

  const invalidMargin = applyLayoutDeclaration(style, "margin", "3% bogus");
  const invalidPadding = applyLayoutDeclaration(style, "padding", "auto");
  const invalidGap = applyLayoutDeclaration(style, "gap", "10% nope");
  const invalidRatio = applyLayoutDeclaration(style, "aspect-ratio", "16 / 0");
  assertEquals(invalidMargin, style);
  assertEquals(invalidPadding, style);
  assertEquals(invalidGap, style);
  assertEquals(invalidRatio, style);
  assertEquals(parseLayoutLength("12oops%", cellLength(7)), cellLength(7));
});

Deno.test("L1 sizing capability metadata exposes the supported CSS surface", () => {
  const report = inspectLayoutSolverCapabilities();
  assertEquals(report.cssProperties["aspect-ratio"], ["aspectRatio"]);
  assertEquals(report.cssProperties["box-sizing"], ["boxSizing"]);
  assertEquals(report.cssProperties.margin, ["margin"]);
  assertEquals(SIMPLE_LAYOUT_SOLVER_CAPABILITIES.style.aspectRatio, "supported");
  assertEquals(SIMPLE_LAYOUT_SOLVER_CAPABILITIES.style.boxSizing, "supported");
  assertEquals(SIMPLE_LAYOUT_SOLVER_CAPABILITIES.style.margin, "partial");
  assertEquals(YOGA_LAYOUT_SOLVER_CAPABILITIES.style.aspectRatio, "unsupported");
  assertEquals(YOGA_LAYOUT_SOLVER_CAPABILITIES.style.margin, "supported");

  assertEquals(
    inspectLayoutDeclarationCompatibility(YOGA_LAYOUT_SOLVER_CAPABILITIES, {
      nodeId: "item",
      property: "margin-left",
      value: "auto",
    }).map(({ code, field }) => [code, field]),
    [["partial-solver-support", "margin"]],
  );
});

Deno.test("L1 content-box and border-box project to equivalent integer-cell boxes", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="content">A</panel><panel id="border">B</panel></window>`,
    css: `
      #content { width: 8; height: 4; padding: 1; border-width: 1; box-sizing: content-box; }
      #border { width: 12; height: 8; padding: 1; border-width: 1; box-sizing: border-box; }
    `,
    bounds: { column: 0, row: 0, width: 30, height: 20 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("content")?.rect, { column: 0, row: 0, width: 12, height: 8 });
  assertEquals(result.layout.byId.get("content")?.contentRect, { column: 2, row: 2, width: 8, height: 4 });
  assertEquals(result.layout.byId.get("border")?.rect, { column: 0, row: 8, width: 12, height: 8 });
  assertEquals(result.layout.byId.get("border")?.contentRect, { column: 2, row: 10, width: 8, height: 4 });
});

Deno.test("L1 aspect-ratio derives the missing box axis before cell clamping", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="content">A</panel>
        <panel id="border">B</panel>
        <panel id="height">C</panel>
        <panel id="floor">D</panel>
      </window>
    `,
    css: `
      #content { width: 8; aspect-ratio: 2; padding: 1; border-width: 1; box-sizing: content-box; }
      #border { width: 12; aspect-ratio: 1.5; padding: 1; border-width: 1; box-sizing: border-box; }
      #height { height: 4; aspect-ratio: 2; box-sizing: border-box; }
      #floor { width: 7; aspect-ratio: 2; box-sizing: border-box; }
    `,
    bounds: { column: 0, row: 0, width: 30, height: 30 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("content")?.rect, { column: 0, row: 0, width: 12, height: 8 });
  assertEquals(result.layout.byId.get("content")?.contentRect, { column: 2, row: 2, width: 8, height: 4 });
  assertEquals(result.layout.byId.get("border")?.rect, { column: 0, row: 8, width: 12, height: 8 });
  assertEquals(result.layout.byId.get("height")?.rect, { column: 0, row: 16, width: 8, height: 4 });
  assertEquals(result.layout.byId.get("floor")?.rect, { column: 0, row: 20, width: 7, height: 3 });
});

Deno.test("L1 percentage padding and margins use the containing inline dimension", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="item">A</panel></window>`,
    css: `#item { width: 10; height: 1; margin: 10% 5%; padding: 10% 5%; box-sizing: content-box; }`,
    bounds: { column: 0, row: 0, width: 40, height: 30 },
    widgets: false,
  });
  const item = result.layout.byId.get("item")!;

  assertEquals(item.margin, { top: 4, right: 2, bottom: 4, left: 2 });
  assertEquals(item.padding, { top: 4, right: 2, bottom: 4, left: 2 });
  assertEquals(item.rect, { column: 2, row: 4, width: 14, height: 9 });
  assertEquals(item.contentRect, { column: 4, row: 8, width: 10, height: 1 });
});

Deno.test("L1 percentage gaps resolve row and column axes independently", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="a">A</panel><panel id="b">B</panel><panel id="c">C</panel>
      </window>
    `,
    css: `
      #root { display: flex; flex-wrap: wrap; align-items: start; align-content: start; gap: 20% 10%; }
      panel { width: 9; height: 1; }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("a")?.rect, { column: 0, row: 0, width: 9, height: 1 });
  assertEquals(result.layout.byId.get("b")?.rect, { column: 11, row: 0, width: 9, height: 1 });
  assertEquals(result.layout.byId.get("c")?.rect, { column: 0, row: 3, width: 9, height: 1 });
});

Deno.test("L1 Flex auto margins absorb main- and cross-axis free cells deterministically", () => {
  const main = createMarkupLayout({
    markup: `<window id="root"><panel id="a">A</panel><panel id="b">B</panel></window>`,
    css: `
      #root { display: flex; align-items: start; }
      panel { width: 2; height: 2; }
      #a { margin-left: auto; }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });
  assertEquals(main.layout.byId.get("a")?.rect, { column: 16, row: 0, width: 2, height: 2 });
  assertEquals(main.layout.byId.get("b")?.rect, { column: 18, row: 0, width: 2, height: 2 });
  assertEquals(main.layout.byId.get("a")?.margin.left, 16);

  const cross = createMarkupLayout({
    markup: `<window id="root"><panel id="item">A</panel></window>`,
    css: `#root { display: flex; align-items: start; } #item { width: 2; height: 2; margin: auto 0; }`,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });
  assertEquals(cross.layout.byId.get("item")?.rect, { column: 0, row: 4, width: 2, height: 2 });
  assertEquals(cross.layout.byId.get("item")?.margin, { top: 4, right: 0, bottom: 4, left: 0 });
});

Deno.test("L1 Flex auto margins preserve the same axis rules in column flow", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="a">A</panel><panel id="b">B</panel></window>`,
    css: `
      #root { display: flex; flex-direction: column; align-items: start; }
      panel { width: 2; height: 2; }
      #a { margin-top: auto; }
      #b { margin-left: auto; }
    `,
    bounds: { column: 0, row: 0, width: 10, height: 12 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("a")?.rect, { column: 0, row: 8, width: 2, height: 2 });
  assertEquals(result.layout.byId.get("b")?.rect, { column: 8, row: 10, width: 2, height: 2 });
});

Deno.test("L1 gap longhands can explicitly override a nonzero shorthand with zero", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="a">A</panel><panel id="b">B</panel></window>`,
    css: `
      #root { display: flex; flex-wrap: wrap; align-items: start; align-content: start; gap: 2; row-gap: 0; }
      panel { width: 4; height: 1; }
    `,
    bounds: { column: 0, row: 0, width: 8, height: 5 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("a")?.rect.row, 0);
  assertEquals(result.layout.byId.get("b")?.rect.row, 1);
  assert(!result.diagnostics.some((diagnostic) => diagnostic.field === "rowGap"));
});

Deno.test("L1 Block inline auto margins center an explicitly sized box", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="item">A</panel></window>`,
    css: `#item { width: 6; height: 1; margin: 0 auto; }`,
    bounds: { column: 0, row: 0, width: 20, height: 5 },
    widgets: false,
  });
  assertEquals(result.layout.byId.get("item")?.rect, { column: 7, row: 0, width: 6, height: 1 });
  assertEquals(result.layout.byId.get("item")?.margin, { top: 0, right: 7, bottom: 0, left: 7 });
});

Deno.test("L1 relative insets shift visuals and hits without moving normal-flow siblings", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="moved"><label id="nested">N</label></panel>
        <panel id="next">B</panel>
      </window>
    `,
    css: `
      #moved { position: relative; left: 10%; top: 20%; width: 5; height: 3; }
      #nested { width: 1; height: 1; }
      #next { width: 2; height: 1; }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("moved")?.rect, { column: 2, row: 2, width: 5, height: 3 });
  assertEquals(result.layout.byId.get("nested")?.rect, { column: 2, row: 2, width: 1, height: 1 });
  assertEquals(result.layout.byId.get("next")?.rect, { column: 0, row: 3, width: 2, height: 1 });
  assertEquals(result.layout.byId.get("moved")?.hitRegions[0]?.bounds, { column: 2, row: 2, width: 5, height: 3 });
  assert(!result.diagnostics.some((diagnostic) => diagnostic.field === "inset"));
});

Deno.test("L1 relative right and bottom insets move opposite while left and top win dual edges", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="opposite">A</panel><panel id="precedence">B</panel></window>`,
    css: `
      panel { width: 2; height: 1; }
      #opposite { position: relative; right: 10%; bottom: 20%; }
      #precedence { position: relative; left: 10%; right: 50%; top: 20%; bottom: 50%; }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("opposite")?.rect, { column: -2, row: -2, width: 2, height: 1 });
  assertEquals(result.layout.byId.get("precedence")?.rect, { column: 2, row: 3, width: 2, height: 1 });
});

Deno.test("L1 sizing diagnostics reject malformed targeted values without mutating defaults", () => {
  const result = createMarkupLayout({
    markup: `<window id="root">A</window>`,
    css: `#root { aspect-ratio: 2 / nope; box-sizing: padding-box; padding: 2% bad; gap: 1% nope; }`,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    widgets: false,
  });

  assertEquals(result.styledRoot.style.aspectRatio, undefined);
  assertEquals(result.styledRoot.style.boxSizing, "border-box");
  assertEquals(result.styledRoot.style.padding, { top: 0, right: 0, bottom: 0, left: 0 });
  assertEquals(result.diagnostics.map(({ code, property }) => [code, property]), [
    ["unsupported-declaration", "aspect-ratio"],
    ["unsupported-declaration", "box-sizing"],
    ["unsupported-declaration", "padding"],
    ["unsupported-declaration", "gap"],
  ]);
});
