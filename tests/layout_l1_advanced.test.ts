import { assert, assertEquals } from "./deps.ts";
import {
  createMarkupLayout,
  inspectLayoutDeclarationCompatibility,
  inspectLayoutSolverCapabilities,
  type LayoutAlignContent,
  SIMPLE_LAYOUT_SOLVER_CAPABILITIES,
  YOGA_LAYOUT_SOLVER_CAPABILITIES,
} from "../mod.ts";

const bounds = { column: 0, row: 0, width: 14, height: 10 };

Deno.test("L1 Flex normalizes reverse directions, align-content, and space-evenly", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="child">X</panel></window>`,
    css: `
      #root {
        display: flex;
        flex-flow: column-reverse wrap;
        align-content: space-evenly;
        justify-content: space-evenly;
      }
    `,
    bounds,
    widgets: false,
  });

  assertEquals(result.styledRoot.style.flexDirection, "column-reverse");
  assertEquals(result.styledRoot.style.flexWrap, "wrap");
  assertEquals(result.styledRoot.style.alignContent, "space-evenly");
  assertEquals(result.styledRoot.style.justifyContent, "space-evenly");
  assertEquals(result.diagnostics, []);

  const report = inspectLayoutSolverCapabilities();
  assertEquals(report.cssProperties["align-content"], ["alignContent"]);
  assertEquals(SIMPLE_LAYOUT_SOLVER_CAPABILITIES.style.flexDirection, "supported");
  assertEquals(SIMPLE_LAYOUT_SOLVER_CAPABILITIES.style.alignContent, "partial");
  assertEquals(YOGA_LAYOUT_SOLVER_CAPABILITIES.style.flexDirection, "partial");
  assertEquals(YOGA_LAYOUT_SOLVER_CAPABILITIES.style.alignContent, "unsupported");
  assertEquals(YOGA_LAYOUT_SOLVER_CAPABILITIES.style.justifyContent, "partial");
});

Deno.test("L1 Flex capability diagnostics make optional Yoga adapter gaps explicit", () => {
  const declarations = [
    { nodeId: "root", property: "flex-direction", value: "row-reverse" },
    { nodeId: "root", property: "align-content", value: "space-between" },
    { nodeId: "root", property: "justify-content", value: "space-evenly" },
  ];

  assertEquals(
    declarations.flatMap((declaration) =>
      inspectLayoutDeclarationCompatibility(YOGA_LAYOUT_SOLVER_CAPABILITIES, declaration)
    ).map(({ code, field }) => [code, field]),
    [
      ["partial-solver-support", "flexDirection"],
      ["unsupported-by-solver", "alignContent"],
      ["partial-solver-support", "justifyContent"],
    ],
  );
});

Deno.test("L1 Flex row-reverse places ordered children from the right main-start edge", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
        <panel id="c">C</panel>
      </window>
    `,
    css: `
      #root { display: flex; flex-direction: row-reverse; align-items: start; }
      panel { width: 2; height: 1; }
    `,
    bounds: { column: 0, row: 0, width: 12, height: 3 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("a")?.rect, { column: 10, row: 0, width: 2, height: 1 });
  assertEquals(result.layout.byId.get("b")?.rect, { column: 8, row: 0, width: 2, height: 1 });
  assertEquals(result.layout.byId.get("c")?.rect, { column: 6, row: 0, width: 2, height: 1 });
});

Deno.test("L1 Flex column-reverse places children from the bottom main-start edge", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
        <panel id="c">C</panel>
      </window>
    `,
    css: `
      #root { display: flex; flex-direction: column-reverse; align-items: start; }
      panel { width: 1; height: 2; }
    `,
    bounds: { column: 0, row: 0, width: 4, height: 8 },
    widgets: false,
  });

  assertEquals(result.layout.byId.get("a")?.rect, { column: 0, row: 6, width: 1, height: 2 });
  assertEquals(result.layout.byId.get("b")?.rect, { column: 0, row: 4, width: 1, height: 2 });
  assertEquals(result.layout.byId.get("c")?.rect, { column: 0, row: 2, width: 1, height: 2 });
});

Deno.test("L1 Flex space-evenly uses deterministic terminal-cell main-axis slots", () => {
  const normal = createMarkupLayout({
    markup: threePanelsMarkup(),
    css: threePanelsCss("row"),
    bounds: { column: 0, row: 0, width: 14, height: 3 },
    widgets: false,
  });
  const reversed = createMarkupLayout({
    markup: threePanelsMarkup(),
    css: threePanelsCss("row-reverse"),
    bounds: { column: 0, row: 0, width: 14, height: 3 },
    widgets: false,
  });

  assertEquals(["a", "b", "c"].map((id) => normal.layout.byId.get(id)?.rect.column), [2, 6, 10]);
  assertEquals(["a", "b", "c"].map((id) => reversed.layout.byId.get(id)?.rect.column), [10, 6, 2]);
});

Deno.test("L1 Flex align-content distributes wrapped lines across the cross axis", () => {
  const expectedRows: Readonly<Record<LayoutAlignContent, readonly [number, number]>> = {
    start: [0, 1],
    end: [9, 10],
    center: [4, 5],
    stretch: [0, 6],
    "space-between": [0, 10],
    "space-around": [2, 8],
    "space-evenly": [3, 7],
  };

  for (const [alignContent, expected] of Object.entries(expectedRows)) {
    const result = wrappedLines(alignContent as LayoutAlignContent);
    assertEquals(
      [result.layout.byId.get("a")!.rect.row, result.layout.byId.get("c")!.rect.row],
      expected,
      `align-content:${alignContent}`,
    );
  }
});

Deno.test("L1 Flex keeps baseline alignment gated on a future text-baseline metric", () => {
  const result = createMarkupLayout({
    markup: `<window id="root"><panel id="child">X</panel></window>`,
    css: `#root { display: flex; align-items: baseline; }`,
    bounds,
    widgets: false,
  });

  assertEquals(result.styledRoot.style.alignItems, "stretch");
  assert(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "unsupported-declaration" && diagnostic.property === "align-items"
    ),
  );
  assert(
    SIMPLE_LAYOUT_SOLVER_CAPABILITIES.limitations.alignItems?.some((detail) => detail.includes("baseline")),
  );
});

function threePanelsMarkup(): string {
  return `
    <window id="root">
      <panel id="a">A</panel>
      <panel id="b">B</panel>
      <panel id="c">C</panel>
    </window>
  `;
}

function threePanelsCss(direction: "row" | "row-reverse"): string {
  return `
    #root {
      display: flex;
      flex-direction: ${direction};
      align-items: start;
      justify-content: space-evenly;
    }
    panel { width: 2; height: 1; }
  `;
}

function wrappedLines(alignContent: LayoutAlignContent) {
  return createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
        <panel id="c">C</panel>
        <panel id="d">D</panel>
      </window>
    `,
    css: `
      #root {
        display: flex;
        flex-flow: row wrap;
        align-items: start;
        align-content: ${alignContent};
      }
      panel { width: 4; height: 1; }
    `,
    bounds: { column: 0, row: 0, width: 10, height: 11 },
    widgets: false,
  });
}
