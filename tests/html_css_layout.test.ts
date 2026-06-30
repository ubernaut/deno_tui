import { assert, assertEquals } from "./deps.ts";
import {
  applyCssCascade,
  ButtonController,
  CheckBoxController,
  ComboBoxController,
  createMarkupLayout,
  hydrateMarkupWidgets,
  InputController,
  MarkupWidgetHydrationRegistry,
  matchesCssSelector,
  parseCssStylesheet,
  parseTuiMarkup,
  RadioGroupController,
  ScrollAreaController,
  SliderController,
  TabsController,
  TextBoxController,
  TreeController,
} from "../mod.ts";
import { yogaLayoutSolver } from "../src/layout/solvers/yoga.ts";
import type { LayoutNode } from "../mod.ts";

Deno.test("parseTuiMarkup builds a layout tree with stable ids classes and text", () => {
  const document = parseTuiMarkup(`
    <window id="main" class="shell unit">
      <button id="run" class="primary">Run</button>
      <input id="query" value="filter" />
    </window>
  `);

  assertEquals(document.root.tag, "window");
  assertEquals(document.root.id, "main");
  assertEquals(document.root.classes, ["shell", "unit"]);
  assertEquals(document.root.children.map((child) => child.id), ["run", "query"]);
  assertEquals(document.root.children[0]!.text, "Run");
  assertEquals(document.root.children[1]!.attributes.value, "filter");
  assertEquals(document.nodeCount, 3);
});

Deno.test("applyCssCascade resolves selectors variables pseudo states and inline styles", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <div id="toolbar" class="toolbar">
        <button id="run" class="primary" style="height: 3">Run</button>
      </div>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    :root {
      --button-bg: #102030;
      color: #eeeeee;
    }

    window .primary {
      width: 12;
      background: var(--button-bg);
    }

    .toolbar > button:focus {
      color: yellow;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet, { states: { run: ["focus"] } });
  const run = findLayoutNode(styled, "run")!;

  assertEquals(
    matchesCssSelector(".toolbar > button:focus", run, [styled, findLayoutNode(styled, "toolbar")!], {
      run: ["focus"],
    }),
    true,
  );
  assertEquals(run.style.width, { unit: "cell", value: 12 });
  assertEquals(run.style.height, { unit: "cell", value: 3 });
  assertEquals(run.style.backgroundColor, "#102030");
  assertEquals(run.style.color, "yellow");
});

Deno.test("createMarkupLayout computes flex boxes from HTML and CSS subset", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <div id="toolbar"><button id="run">Run</button></div>
        <scroll-area id="body">Process table and charts</scroll-area>
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
        padding: 0 1;
      }

      #body {
        flex: 1;
        min-height: 2;
        overflow: auto;
      }
    `,
    bounds: { column: 0, row: 0, width: 80, height: 24 },
  });

  const main = result.layout.byId.get("main")!;
  const toolbar = result.layout.byId.get("toolbar")!;
  const body = result.layout.byId.get("body")!;

  assertEquals(main.rect, { column: 0, row: 0, width: 80, height: 24 });
  assertEquals(toolbar.rect, { column: 0, row: 0, width: 80, height: 3 });
  assertEquals(toolbar.contentRect, { column: 1, row: 0, width: 78, height: 3 });
  assertEquals(body.rect, { column: 0, row: 3, width: 80, height: 21 });
  assertEquals(body.overflowY, "auto");
  assertEquals(body.hitRegions[0]!.payload, { nodeId: "body", tag: "scroll-area" });
});

Deno.test("createMarkupLayout hydrates common widgets and dispatches controller events", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <button id="run">Run</button>
        <input id="query" value="deno" />
        <input id="gain" type="range" min="0" max="100" step="5" value="10" />
        <input id="live" type="checkbox" checked />
        <select id="theme">
          <option value="unit">Unit-01</option>
          <option value="tide" selected>Arcane Tide</option>
        </select>
        <radio-group id="mode" value="fast">
          <radio value="fast">Fast</radio>
          <radio value="slow">Slow</radio>
        </radio-group>
        <tabs id="views">
          <tab id="monitor">Monitor</tab>
          <tab id="three">Three</tab>
        </tabs>
        <textarea id="notes" word-wrap>ready</textarea>
        <scroll-area id="logs" content-width="120" content-height="40"></scroll-area>
        <tree id="files">
          <tree-node id="src" label="src" expanded>
            <tree-node id="mod" label="mod.ts"></tree-node>
          </tree-node>
        </tree>
      </window>
    `,
    css: `
      window {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
    `,
    bounds: { column: 0, row: 0, width: 80, height: 24 },
  });

  assertEquals(result.widgets.inspect().focusOrder, [
    "run",
    "query",
    "gain",
    "live",
    "theme",
    "mode",
    "views",
    "notes",
    "logs",
    "files",
  ]);

  const run = result.widgets.byId.get("run")?.controller;
  assert(run instanceof ButtonController);
  assertEquals(result.widgets.dispatch({ type: "press", id: "run", method: "mouse", now: 10 }), true);
  assertEquals(run.inspect().pressCount, 1);
  assertEquals(run.inspect().lastMethod, "mouse");

  const query = result.widgets.byId.get("query")?.controller;
  assert(query instanceof InputController);
  result.widgets.dispatch({ type: "input", id: "query", value: "deno task" });
  result.widgets.dispatch({ type: "key", id: "query", key: "space" });
  assertEquals(query.inspect().text, "deno task ");

  const gain = result.widgets.byId.get("gain")?.controller;
  assert(gain instanceof SliderController);
  result.widgets.dispatch({ type: "set-value", id: "gain", value: 55 });
  assertEquals(gain.inspect().value, 55);
  result.widgets.dispatch({
    type: "pointer",
    id: "gain",
    column: 20,
    row: 0,
    track: { column: 0, row: 0, width: 21, height: 1 },
  });
  assertEquals(gain.inspect().value, 100);

  const live = result.widgets.byId.get("live")?.controller;
  assert(live instanceof CheckBoxController);
  result.widgets.dispatch({ type: "toggle", id: "live" });
  assertEquals(live.inspect().checked, false);

  const theme = result.widgets.byId.get("theme")?.controller;
  assert(theme instanceof ComboBoxController);
  assertEquals(theme.inspect().selected, "Arcane Tide");
  result.widgets.dispatch({ type: "select", id: "theme", index: 0 });
  assertEquals(theme.inspect().selected, "Unit-01");

  const mode = result.widgets.byId.get("mode")?.controller;
  assert(mode instanceof RadioGroupController);
  result.widgets.dispatch({ type: "select", id: "mode", value: "slow" });
  assertEquals(mode.inspect().selectedValue, "slow");

  const views = result.widgets.byId.get("views")?.controller;
  assert(views instanceof TabsController);
  result.widgets.dispatch({ type: "key", id: "views", key: "right" });
  assertEquals(views.inspect().active?.id, "three");

  const notes = result.widgets.byId.get("notes")?.controller;
  assert(notes instanceof TextBoxController);
  result.widgets.dispatch({ type: "input", id: "notes", value: "first\nsecond" });
  assertEquals(notes.inspect().lineCount, 2);
  assertEquals(notes.inspect().wordWrap, true);

  const logs = result.widgets.byId.get("logs")?.controller;
  assert(logs instanceof ScrollAreaController);
  result.widgets.dispatch({ type: "scroll", id: "logs", rows: 7 });
  assertEquals(logs.inspect().offset.rows, 7);

  const files = result.widgets.byId.get("files")?.controller;
  assert(files instanceof TreeController);
  result.widgets.dispatch({ type: "select", id: "files", value: "mod" });
  assertEquals(files.inspect().selected?.label, "mod.ts");

  result.widgets.dispose();
});

Deno.test("hydrateMarkupWidgets supports custom widget registries", () => {
  const document = parseTuiMarkup(`<meter id="cpu" value="42"></meter>`);
  const registry = new MarkupWidgetHydrationRegistry();
  registry.register("meter", () => ({
    kind: "container",
    focusable: false,
    actions: [],
  }));

  const widgets = hydrateMarkupWidgets(document.root, { registry });

  assertEquals(widgets.inspect().widgetCount, 1);
  assertEquals(widgets.byId.get("cpu")?.kind, "container");
});

Deno.test("yogaLayoutSolver computes basic flex boxes through the markup API", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <div id="toolbar">Tools</div>
        <scroll-area id="body">Process table and charts</scroll-area>
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
    solver: yogaLayoutSolver(),
  });

  assertEquals(result.layout.byId.get("toolbar")!.rect, { column: 0, row: 0, width: 80, height: 3 });
  assertEquals(result.layout.byId.get("body")!.rect, { column: 0, row: 3, width: 80, height: 21 });
});

function findLayoutNode(node: LayoutNode, id: string): LayoutNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findLayoutNode(child, id);
    if (found) return found;
  }
  return undefined;
}
