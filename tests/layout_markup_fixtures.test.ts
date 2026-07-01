import { assertEquals } from "./deps.ts";
import { createMarkupLayout, simpleLayoutSolver } from "../mod.ts";
import type { LayoutSolver, Rectangle } from "../mod.ts";
import { yogaLayoutSolver } from "../src/layout/solvers/yoga.ts";

interface ExpectedBox {
  id: string;
  rect: Rectangle;
}

interface LayoutFixture {
  name: string;
  markup: string;
  css: string;
  bounds: Rectangle;
  expected: ExpectedBox[];
  solvers: Array<{
    name: string;
    solver: () => LayoutSolver;
  }>;
}

const sharedFlexSolvers = [
  { name: "simple", solver: () => simpleLayoutSolver() },
  { name: "yoga", solver: () => yogaLayoutSolver() },
];

const fixtures: LayoutFixture[] = [
  {
    name: "column shell with fixed toolbar and flexible body",
    markup: `
      <window id="main">
        <menu-bar id="toolbar">Tools</menu-bar>
        <scroll-area id="body">Rows</scroll-area>
      </window>
    `,
    css: `
      window {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      #toolbar {
        height: 3;
      }

      #body {
        flex: 1;
        min-height: 2;
        overflow: auto;
      }
    `,
    bounds: { column: 0, row: 0, width: 80, height: 24 },
    expected: [
      { id: "main", rect: { column: 0, row: 0, width: 80, height: 24 } },
      { id: "toolbar", rect: { column: 0, row: 0, width: 80, height: 3 } },
      { id: "body", rect: { column: 0, row: 3, width: 80, height: 21 } },
    ],
    solvers: sharedFlexSolvers,
  },
  {
    name: "wrapped row flex cards",
    markup: `
      <window id="main">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
        <panel id="c">C</panel>
      </window>
    `,
    css: `
      window {
        display: flex;
        flex-flow: row wrap;
        align-items: start;
        width: 100%;
        height: 100%;
        gap: 1;
      }

      panel {
        width: 4;
        height: 1;
      }
    `,
    bounds: { column: 0, row: 0, width: 10, height: 6 },
    expected: [
      { id: "main", rect: { column: 0, row: 0, width: 10, height: 6 } },
      { id: "a", rect: { column: 0, row: 0, width: 4, height: 1 } },
      { id: "b", rect: { column: 5, row: 0, width: 4, height: 1 } },
      { id: "c", rect: { column: 0, row: 2, width: 4, height: 1 } },
    ],
    solvers: sharedFlexSolvers,
  },
  {
    name: "grid placement with spanning cell",
    markup: `
      <window id="main">
        <panel id="left">Left</panel>
        <panel id="right">Right</panel>
        <panel id="footer">Footer</panel>
      </window>
    `,
    css: `
      window {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 3 2;
        width: 20;
        height: 6;
        gap: 1;
      }

      #footer {
        grid-column: 1 / span 2;
        grid-row: 2;
      }
    `,
    bounds: { column: 2, row: 1, width: 30, height: 10 },
    expected: [
      { id: "main", rect: { column: 2, row: 1, width: 20, height: 6 } },
      { id: "left", rect: { column: 2, row: 1, width: 9, height: 3 } },
      { id: "right", rect: { column: 12, row: 1, width: 10, height: 3 } },
      { id: "footer", rect: { column: 2, row: 5, width: 20, height: 2 } },
    ],
    solvers: [{ name: "simple", solver: () => simpleLayoutSolver() }],
  },
];

for (const fixture of fixtures) {
  for (const solver of fixture.solvers) {
    Deno.test(`layout fixture: ${fixture.name} (${solver.name})`, () => {
      const result = createMarkupLayout({
        markup: fixture.markup,
        css: fixture.css,
        bounds: fixture.bounds,
        solver: solver.solver(),
        widgets: false,
      });

      for (const expected of fixture.expected) {
        assertEquals(result.layout.byId.get(expected.id)?.rect, expected.rect, expected.id);
      }
    });
  }
}
