import { assert, assertEquals } from "./deps.ts";
import {
  applyCssCascade,
  ButtonController,
  CheckBoxController,
  ComboBoxController,
  createHtmlCssLayoutDemo,
  createLayoutNode,
  createMarkupLayout,
  createMarkupLayoutWorkerHandler,
  defaultComputedLayoutStyle,
  hydrateMarkupWidgets,
  InputController,
  inspectTuiCssSupport,
  LayoutMeasurementCache,
  layoutTree,
  MarkupLayoutCache,
  MarkupWidgetHydrationRegistry,
  matchesCssMedia,
  matchesCssSelector,
  measureTerminalTextIntrinsic,
  parseCssMediaQuery,
  parseCssStylesheet,
  parseTuiMarkup,
  RadioGroupController,
  runMarkupLayoutInWorker,
  ScrollAreaController,
  selectorParts,
  simpleLayoutSolver,
  SliderController,
  TabsController,
  TextBoxController,
  TreeController,
  WorkerPool,
} from "../mod.ts";
import { yogaLayoutSolver } from "../src/layout/solvers/yoga.ts";
import type { LayoutNode, MarkupLayoutWorkerPayload, MarkupLayoutWorkerResult } from "../mod.ts";

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
  const toolbar = findLayoutNode(styled, "toolbar")!;

  assertEquals(
    matchesCssSelector(".toolbar > button:focus", run, [styled, toolbar], {
      run: ["focus"],
    }),
    true,
  );
  assertEquals(run.style.width, { unit: "cell", value: 12 });
  assertEquals(run.style.height, { unit: "cell", value: 3 });
  assertEquals(run.style.backgroundColor, "#102030");
  assertEquals(run.style.color, "yellow");
});

Deno.test("selectorParts parses child and descendant combinators without spacing assumptions", () => {
  assertEquals(selectorParts("window .toolbar>button:focus"), [
    { simple: "window", combinator: undefined },
    { simple: ".toolbar", combinator: "descendant" },
    { simple: "button:focus", combinator: "child" },
  ]);
  assertEquals(selectorParts("window   panel >  button.primary"), [
    { simple: "window", combinator: undefined },
    { simple: "panel", combinator: "descendant" },
    { simple: "button.primary", combinator: "child" },
  ]);
});

Deno.test("applyCssCascade supports attribute selectors", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <button id="save" data-tone="primary">Save</button>
      <button id="disabled" disabled>Disabled</button>
      <button id="plain">Plain</button>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    button {
      width: 8;
    }

    button[data-tone="primary"] {
      width: 14;
      background: #123456;
    }

    [disabled] {
      color: #777777;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);
  const save = findLayoutNode(styled, "save")!;
  const disabled = findLayoutNode(styled, "disabled")!;
  const plain = findLayoutNode(styled, "plain")!;

  assertEquals(matchesCssSelector('button[data-tone="primary"]', save, [styled]), true);
  assertEquals(matchesCssSelector("[disabled]", disabled, [styled]), true);
  assertEquals(matchesCssSelector("[disabled]", plain, [styled]), false);
  assertEquals(save.style.width, { unit: "cell", value: 14 });
  assertEquals(save.style.backgroundColor, "#123456");
  assertEquals(disabled.style.color, "#777777");
  assertEquals(plain.style.width, { unit: "cell", value: 8 });
});

Deno.test("applyCssCascade supports bounded structural pseudo selectors", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <button id="one">One</button>
      <button id="two">Two</button>
      <button id="three">Three</button>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    button:first-child {
      width: 8;
    }

    button:nth-child(even) {
      background: #112233;
    }

    button:nth-child(3) {
      color: #eeee00;
    }

    button:last-child {
      height: 2;
    }

    button:nth-child(2n+1) {
      border-width: 3;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);
  const one = findLayoutNode(styled, "one")!;
  const two = findLayoutNode(styled, "two")!;
  const three = findLayoutNode(styled, "three")!;

  assertEquals(matchesCssSelector("button:first-child", one, [styled]), true);
  assertEquals(matchesCssSelector("button:last-child", three, [styled]), true);
  assertEquals(matchesCssSelector("button:nth-child(even)", two, [styled]), true);
  assertEquals(matchesCssSelector("button:nth-child(2n+1)", one, [styled]), false);
  assertEquals(one.style.width, { unit: "cell", value: 8 });
  assertEquals(two.style.backgroundColor, "#112233");
  assertEquals(three.style.color, "#eeee00");
  assertEquals(three.style.height, { unit: "cell", value: 2 });
  assertEquals(one.style.border, { top: 0, right: 0, bottom: 0, left: 0 });
});

Deno.test("applyCssCascade supports only-child pseudo selector", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <panel id="single"><button id="solo">Solo</button></panel>
      <panel id="pair"><button id="left">Left</button><button id="right">Right</button></panel>
    </window>
  `);
  const styled = applyCssCascade(
    document.root,
    parseCssStylesheet(`
      button:only-child {
        color: #00ff99;
      }
    `),
  );
  const single = findLayoutNode(styled, "single")!;
  const pair = findLayoutNode(styled, "pair")!;

  assertEquals(matchesCssSelector("button:only-child", findLayoutNode(styled, "solo")!, [styled, single]), true);
  assertEquals(matchesCssSelector("button:only-child", findLayoutNode(styled, "left")!, [styled, pair]), false);
  assertEquals(findLayoutNode(styled, "solo")!.style.color, "#00ff99");
  assertEquals(findLayoutNode(styled, "left")!.style.color, undefined);
});

Deno.test("applyCssCascade parses flex flow shorthand into direction and wrapping", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <panel id="a"></panel>
      <panel id="b"></panel>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    window {
      display: flex;
      flex-flow: column wrap-reverse;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);

  assertEquals(styled.style.flexDirection, "column");
  assertEquals(styled.style.flexWrap, "wrap-reverse");
});

Deno.test("applyCssCascade parses grid templates placement and auto flow", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <panel id="wide"></panel>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    window {
      display: grid;
      grid-template-columns: repeat(2, 1fr) 12;
      grid-template-rows: 3 1fr;
      grid-auto-flow: column dense;
      grid-auto-rows: 2;
    }

    #wide {
      grid-column: 2 / span 2;
      grid-row: 1 / span 2;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);
  const wide = findLayoutNode(styled, "wide")!;

  assertEquals(styled.style.display, "grid");
  assertEquals(styled.style.gridTemplateColumns, [
    { unit: "fr", value: 1 },
    { unit: "fr", value: 1 },
    { unit: "cell", value: 12 },
  ]);
  assertEquals(styled.style.gridTemplateRows, [
    { unit: "cell", value: 3 },
    { unit: "fr", value: 1 },
  ]);
  assertEquals(styled.style.gridAutoFlow, "column");
  assertEquals(styled.style.gridAutoRows, { unit: "cell", value: 2 });
  assertEquals(wide.style.gridColumn, { start: 2, span: 2 });
  assertEquals(wide.style.gridRow, { start: 1, span: 2 });
});

Deno.test("applyCssCascade parses grid line longhands", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <panel id="span"></panel>
      <panel id="ended"></panel>
    </window>
  `);
  const stylesheet = parseCssStylesheet(`
    #span {
      grid-column-start: 2;
      grid-column-end: 4;
      grid-row-start: 1;
      grid-row-end: span 2;
    }

    #ended {
      grid-column-end: 5;
      grid-column-start: span 2;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);
  const span = findLayoutNode(styled, "span")!;
  const ended = findLayoutNode(styled, "ended")!;

  assertEquals(span.style.gridColumn, { start: 2, end: 4, span: 2 });
  assertEquals(span.style.gridRow, { start: 1, span: 2 });
  assertEquals(ended.style.gridColumn, { end: 5, span: 2 });
});

Deno.test("applyCssCascade parses grid item self alignment", () => {
  const document = parseTuiMarkup(`<window id="main"><panel id="card"></panel></window>`);
  const stylesheet = parseCssStylesheet(`
    #card {
      place-self: end center;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);
  const card = findLayoutNode(styled, "card")!;

  assertEquals(card.style.alignSelf, "end");
  assertEquals(card.style.justifySelf, "center");
});

Deno.test("applyCssCascade inherits visibility while allowing explicit visible descendants", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="hidden">
          <button id="inherited">Inherited</button>
          <button id="override">Override</button>
        </panel>
      </window>
    `,
    css: `
      #hidden {
        visibility: hidden;
      }

      #override {
        visibility: visible;
      }
    `,
    bounds: { column: 0, row: 0, width: 40, height: 8 },
  });

  const hidden = result.layout.byId.get("hidden")!;
  const inherited = result.layout.byId.get("inherited")!;
  const override = result.layout.byId.get("override")!;

  assertEquals(hidden.visible, false);
  assertEquals(inherited.visible, false);
  assertEquals(override.visible, true);
  assertEquals(hidden.hitRegions, []);
  assertEquals(inherited.hitRegions, []);
  assertEquals(override.hitRegions.length, 1);
});

Deno.test("applyCssCascade parses terminal text flow properties", () => {
  const document = parseTuiMarkup(`
    <window id="main">
      <panel id="nowrap">alpha beta</panel>
      <panel id="break">abcdefghij</panel>
    </window>
  `);
  const styled = applyCssCascade(
    document.root,
    parseCssStylesheet(`
    #nowrap {
      white-space: nowrap;
    }

    #break {
      overflow-wrap: anywhere;
    }
  `),
  );

  assertEquals(findLayoutNode(styled, "nowrap")!.style.whiteSpace, "nowrap");
  assertEquals(findLayoutNode(styled, "break")!.style.overflowWrap, "anywhere");
});

Deno.test("parseCssStylesheet keeps terminal-cell media query metadata", () => {
  const stylesheet = parseCssStylesheet(`
    panel {
      width: 20;
    }

    @media (max-width: 40) and (min-height: 8) {
      panel.card {
        width: 12;
      }
    }
  `);

  assertEquals(stylesheet.rules.length, 2);
  assertEquals(stylesheet.rules[1]!.media?.conditions, [
    { feature: "max-width", value: 40 },
    { feature: "min-height", value: 8 },
  ]);
  assertEquals(matchesCssMedia(stylesheet.rules[1]!.media, { width: 32, height: 10 }), true);
  assertEquals(matchesCssMedia(stylesheet.rules[1]!.media, { width: 48, height: 10 }), false);
  assertEquals(parseCssMediaQuery("(min-width: 80cells)")?.conditions, [{ feature: "min-width", value: 80 }]);
});

Deno.test("inspectTuiCssSupport reports the documented HTML/CSS subset", () => {
  const report = inspectTuiCssSupport();

  assert(report.properties.includes("grid-template-columns"));
  assert(report.properties.includes("grid-template-areas"));
  assert(report.properties.includes("flex-flow"));
  assert(report.properties.includes("white-space"));
  assert(report.properties.includes("overflow-wrap"));
  assert(report.selectors.includes(":first-child"));
  assert(report.selectors.includes(":nth-child(number|odd|even)"));
  assert(report.mediaFeatures.includes("max-width"));
  assert(report.pseudoStates.includes("focus"));
  assert(report.hydratedWidgetTags.includes("radio-group"));
  assert(report.hydratedWidgetTags.includes("tree"));
  assert(report.markupTags.includes("three-ascii"));
  assert(report.unsupported.includes("Yoga solver named grid-area parity"));
});

Deno.test("createMarkupLayout applies media rules from layout bounds", () => {
  const markup = `<window id="main"><panel id="card" class="card">Card</panel></window>`;
  const css = `
    window {
      width: 100%;
      height: 100%;
    }

    .card {
      width: 20;
      height: 2;
    }

    @media (max-width: 40) {
      .card {
        width: 12;
      }
    }
  `;

  const wide = createMarkupLayout({ markup, css, bounds: { column: 0, row: 0, width: 80, height: 12 } });
  const narrow = createMarkupLayout({ markup, css, bounds: { column: 0, row: 0, width: 32, height: 12 } });

  assertEquals(wide.layout.byId.get("card")!.rect.width, 20);
  assertEquals(narrow.layout.byId.get("card")!.rect.width, 12);
});

Deno.test("MarkupLayoutCache reuses parsed markup and stylesheets with cloned results", () => {
  const cache = new MarkupLayoutCache({ maxEntries: 2 });
  const options = {
    markup: `<window id="main"><panel id="card">Card</panel></window>`,
    css: `#card { width: 10; height: 2; }`,
    bounds: { column: 0, row: 0, width: 40, height: 8 },
    cache,
  };

  const first = createMarkupLayout(options);
  first.document.root.children[0]!.id = "mutated";
  first.styledRoot.children[0]!.style.width = { unit: "cell", value: 99 };

  const second = createMarkupLayout(options);

  assertEquals(cache.inspect(), { documents: 1, stylesheets: 1, maxEntries: 2 });
  assertEquals(second.document.root.children[0]!.id, "card");
  assertEquals(second.layout.byId.get("card")!.rect.width, 10);
});

Deno.test("MarkupLayoutCache can be disabled per layout call", () => {
  const cache = new MarkupLayoutCache();
  createMarkupLayout({
    markup: `<window id="main"></window>`,
    css: `window { width: 10; }`,
    bounds: { column: 0, row: 0, width: 20, height: 4 },
    cache: false,
  });

  assertEquals(cache.inspect(), { documents: 0, stylesheets: 0, maxEntries: 32 });
});

Deno.test("createMarkupLayoutWorkerHandler solves markup layout without hydrating controllers", () => {
  const handler = createMarkupLayoutWorkerHandler();
  const markup = `<window id="main"><panel id="left">A</panel><panel id="right">B</panel></window>`;
  const css = `window { display: flex; flex-direction: row; } panel { width: 10; height: 4; }`;
  const first = handler({
    markup,
    css,
    bounds: { column: 0, row: 0, width: 30, height: 6 },
  });
  const second = handler({
    markup,
    css,
    bounds: { column: 0, row: 0, width: 30, height: 6 },
  });

  assertEquals(first.layout.byId.get("right")?.rect.column, 10);
  assertEquals(first.layout.boxes.length, 3);
  assertEquals(first.cache, { documents: 1, stylesheets: 1, maxEntries: 32 });
  assertEquals(second.cache, { documents: 1, stylesheets: 1, maxEntries: 32 });
});

Deno.test("runMarkupLayoutInWorker solves markup layout through WorkerPool", async () => {
  const workerUrl = new URL("./fixtures/markup_layout_worker.ts", import.meta.url);
  const permission = await Deno.permissions.query({ name: "read", path: workerUrl });
  if (permission.state !== "granted") return;
  const pool = new WorkerPool<MarkupLayoutWorkerPayload, MarkupLayoutWorkerResult>({
    workerUrl,
    size: 1,
  });
  try {
    const result = await runMarkupLayoutInWorker(pool, {
      markup: `<window id="main"><panel id="hero">Hero</panel></window>`,
      css: `#hero { width: 18; height: 3; }`,
      bounds: { column: 2, row: 1, width: 40, height: 10 },
    });

    assertEquals(result.document.nodeCount, 2);
    assertEquals(result.layout.byId.get("hero")?.rect, { column: 2, row: 1, width: 18, height: 3 });
  } finally {
    pool.terminate();
  }
});

Deno.test("createMarkupLayout computes CSS grid tracks and item placement", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
        <panel id="c">C</panel>
      </window>
    `,
    css: `
      window {
        display: grid;
        grid-template-columns: 10 1fr 5;
        grid-template-rows: 2 1fr;
        gap: 1;
        width: 100%;
        height: 100%;
      }

      #a {
        grid-column: 2;
        grid-row: 1 / span 2;
      }

      #b {
        grid-column: 1;
        grid-row: 2;
      }
    `,
    bounds: { column: 0, row: 0, width: 30, height: 8 },
  });

  assertEquals(result.layout.byId.get("a")!.rect, { column: 11, row: 0, width: 13, height: 8 });
  assertEquals(result.layout.byId.get("b")!.rect, { column: 0, row: 3, width: 10, height: 5 });
  assertEquals(result.layout.byId.get("c")!.rect, { column: 0, row: 0, width: 10, height: 2 });
});

Deno.test("createMarkupLayout supports grid numeric end lines and longhands", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="wide">Wide</panel>
        <panel id="from-end">From end</panel>
      </window>
    `,
    css: `
      window {
        display: grid;
        grid-template-columns: repeat(4, 5);
        grid-template-rows: 2 2;
        gap: 1;
        width: 23;
        height: 5;
      }

      #wide {
        grid-column: 2 / 4;
        grid-row: 1;
      }

      #from-end {
        grid-column-end: 5;
        grid-column-start: span 2;
        grid-row-start: 2;
      }
    `,
    bounds: { column: 0, row: 0, width: 40, height: 8 },
  });

  assertEquals(result.layout.byId.get("wide")!.rect, { column: 6, row: 0, width: 11, height: 2 });
  assertEquals(result.layout.byId.get("from-end")!.rect, { column: 12, row: 3, width: 11, height: 2 });
});

Deno.test("createMarkupLayout supports CSS grid template areas in the simple solver", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="title">Title</panel>
        <panel id="nav">Nav</panel>
        <panel id="content">Content</panel>
        <panel id="footer">Footer</panel>
      </window>
    `,
    css: `
      window {
        display: grid;
        grid-template-columns: 6 1fr;
        grid-template-rows: 2 1fr 1;
        grid-template-areas:
          "title title"
          "nav content"
          "footer footer";
        gap: 1;
        width: 24;
        height: 10;
      }

      #title { grid-area: title; }
      #nav { grid-area: nav; }
      #content { grid-area: content; }
      #footer { grid-area: footer; }
    `,
    bounds: { column: 0, row: 0, width: 40, height: 12 },
  });

  assertEquals(result.layout.byId.get("title")!.rect, { column: 0, row: 0, width: 24, height: 2 });
  assertEquals(result.layout.byId.get("nav")!.rect, { column: 0, row: 3, width: 6, height: 5 });
  assertEquals(result.layout.byId.get("content")!.rect, { column: 7, row: 3, width: 17, height: 5 });
  assertEquals(result.layout.byId.get("footer")!.rect, { column: 0, row: 9, width: 24, height: 1 });
});

Deno.test("createMarkupLayout aligns explicit grid item sizes with place-self", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="centered">Centered</panel>
        <panel id="ended">Ended</panel>
      </window>
    `,
    css: `
      window {
        display: grid;
        grid-template-columns: 10 10;
        grid-template-rows: 6;
        gap: 1;
        width: 21;
        height: 6;
      }

      #centered {
        width: 4;
        height: 2;
        place-self: center center;
      }

      #ended {
        width: 3;
        height: 2;
        justify-self: end;
        align-self: end;
      }
    `,
    bounds: { column: 0, row: 0, width: 30, height: 8 },
  });

  assertEquals(result.layout.byId.get("centered")!.rect, { column: 3, row: 2, width: 4, height: 2 });
  assertEquals(result.layout.byId.get("ended")!.rect, { column: 18, row: 4, width: 3, height: 2 });
});

Deno.test("applyCssCascade parses absolute positioning inset declarations", () => {
  const document = parseTuiMarkup(`<panel id="badge"></panel>`);
  const stylesheet = parseCssStylesheet(`
    panel {
      position: absolute;
      inset: 1 2 auto auto;
      left: 4;
    }
  `);

  const styled = applyCssCascade(document.root, stylesheet);

  assertEquals(styled.style.position, "absolute");
  assertEquals(styled.style.inset.top, { unit: "cell", value: 1 });
  assertEquals(styled.style.inset.right, { unit: "cell", value: 2 });
  assertEquals(styled.style.inset.bottom, { unit: "auto", value: 0 });
  assertEquals(styled.style.inset.left, { unit: "cell", value: 4 });
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
  assertEquals(body.overflow.rows.overflow, "auto");
  assertEquals(body.overflow.rows.canScroll, false);
  assertEquals(body.hitRegions[0]!.payload, { nodeId: "body", tag: "scroll-area" });
});

Deno.test("layout boxes expose shared overflow inspection for scrollable content", () => {
  const result = createMarkupLayout({
    markup: `
      <panel id="body">
        <div id="wide"></div>
      </panel>
    `,
    css: `
      #body {
        width: 10;
        height: 4;
        overflow: auto;
      }

      #wide {
        position: absolute;
        width: 30;
        height: 8;
      }
    `,
    bounds: { column: 0, row: 0, width: 40, height: 12 },
  });

  const body = result.layout.byId.get("body")!;
  assertEquals(body.overflow.columns.contentLength, 30);
  assertEquals(body.overflow.columns.viewportLength, 10);
  assertEquals(body.overflow.columns.maxOffset, 20);
  assertEquals(body.overflow.columns.scrollbarVisible, true);
  assertEquals(body.overflow.rows.contentLength, 8);
  assertEquals(body.overflow.rows.viewportLength, 4);
  assertEquals(body.overflow.rows.maxOffset, 4);
  assertEquals(body.overflow.rows.scrollbarVisible, true);
});

Deno.test("createMarkupLayout wraps flex rows in the simple solver", () => {
  const result = createMarkupLayout({
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
  });

  assertEquals(result.layout.byId.get("a")!.rect, { column: 0, row: 0, width: 4, height: 1 });
  assertEquals(result.layout.byId.get("b")!.rect, { column: 5, row: 0, width: 4, height: 1 });
  assertEquals(result.layout.byId.get("c")!.rect, { column: 0, row: 2, width: 4, height: 1 });
});

Deno.test("createMarkupLayout reuses intrinsic measurements in the simple solver", () => {
  const cache = new LayoutMeasurementCache();
  const solver = simpleLayoutSolver({ intrinsicMeasurementCache: cache });
  const options = {
    markup: `
      <window id="main">
        <panel id="a">A longer text value that wraps in narrow panes</panel>
        <panel id="b">A longer text value that wraps in narrow panes</panel>
      </window>
    `,
    css: `
      window {
        display: flex;
        flex-flow: row wrap;
        width: 100%;
        height: 100%;
      }

      panel {
        width: auto;
        height: auto;
      }
    `,
    bounds: { column: 0, row: 0, width: 24, height: 8 },
    solver,
  };

  const first = createMarkupLayout(options);
  const afterFirst = cache.stats();
  const second = createMarkupLayout(options);
  const afterSecond = cache.stats();

  assert(afterFirst.entries > 0);
  assert(afterSecond.hits > afterFirst.hits);
  assertEquals(second.layout.byId.get("a")!.rect, first.layout.byId.get("a")!.rect);
  assertEquals(second.layout.byId.get("b")!.rect, first.layout.byId.get("b")!.rect);
});

Deno.test("measureTerminalTextIntrinsic wraps text on terminal word boundaries", () => {
  assertEquals(measureTerminalTextIntrinsic("aa bbbb cc", 6), { width: 10, height: 3 });
  assertEquals(measureTerminalTextIntrinsic("wide\ntext", 6), { width: 4, height: 2 });
  assertEquals(measureTerminalTextIntrinsic("abcdefghij", 5), { width: 10, height: 2 });
  assertEquals(measureTerminalTextIntrinsic("abc ", 3), { width: 4, height: 1 });
  assertEquals(measureTerminalTextIntrinsic("alpha beta", 5, 1, { wrap: false }), { width: 10, height: 1 });
  assertEquals(measureTerminalTextIntrinsic("abcdefghij", 5, 1, { breakWords: false }), { width: 10, height: 1 });
  assertEquals(measureTerminalTextIntrinsic("aa\tbb cc", 5), { width: 8, height: 2 });
});

Deno.test("simple layout solver measures auto height after resolving explicit text width", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="card">aa bbbb cc</panel>
      </window>
    `,
    css: `
      #card {
        width: 6;
        height: auto;
      }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 12 },
  });

  assertEquals(result.layout.byId.get("card")!.rect, { column: 0, row: 0, width: 6, height: 3 });
});

Deno.test("createMarkupLayout applies CSS text wrapping properties to intrinsic height", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="normal">abcdefghij</panel>
        <panel id="break">abcdefghij</panel>
        <panel id="nowrap">aa bbbb cc</panel>
      </window>
    `,
    css: `
      panel {
        width: 5;
        height: auto;
      }

      #break {
        overflow-wrap: anywhere;
      }

      #nowrap {
        white-space: nowrap;
      }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 12 },
  });

  assertEquals(result.layout.byId.get("normal")!.rect.height, 1);
  assertEquals(result.layout.byId.get("break")!.rect.height, 2);
  assertEquals(result.layout.byId.get("nowrap")!.rect.height, 1);
});

Deno.test("simple layout solver merges partial intrinsic dimensions with measured fallback", () => {
  const rootStyle = defaultComputedLayoutStyle();
  rootStyle.display = "flex";
  rootStyle.flexDirection = "row";
  rootStyle.alignItems = "start";

  const heightOnly = createLayoutNode({
    id: "height-only",
    tag: "panel",
    text: "wide text",
    intrinsic: { height: 3 },
  });
  const widthOnly = createLayoutNode({
    id: "width-only",
    tag: "panel",
    text: "one two three four five six",
    intrinsic: { width: 9 },
  });
  const root = createLayoutNode({
    id: "root",
    tag: "window",
    style: rootStyle,
    children: [heightOnly, widthOnly],
  });

  const result = layoutTree(root, { column: 0, row: 0, width: 40, height: 10 });

  assertEquals(result.byId.get("height-only")!.rect.width, 9);
  assertEquals(result.byId.get("height-only")!.rect.height, 3);
  assertEquals(result.byId.get("width-only")!.rect.width, 9);
  assertEquals(result.byId.get("width-only")!.rect.height > 1, true);
});

Deno.test("simple layout solver intrinsic block sizing ignores non-flow children and applies gap", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="card">
          <panel id="a">A</panel>
          <panel id="gone">Hidden</panel>
          <panel id="float">Float</panel>
          <panel id="b">B</panel>
        </panel>
      </window>
    `,
    css: `
      #card { height: auto; gap: 2; }
      #a { height: 2; }
      #b { height: 3; }
      #gone { display: none; height: 20; }
      #float { position: absolute; height: 12; }
    `,
    bounds: { column: 0, row: 0, width: 30, height: 20 },
  });

  assertEquals(result.layout.byId.get("card")!.rect.height, 7);
});

Deno.test("simple layout solver intrinsic flex row basis uses gap fallback and ignores non-flow children", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="root">
        <panel id="cluster">
          <panel id="a">A</panel>
          <panel id="gone">Hidden</panel>
          <panel id="float">Float</panel>
          <panel id="b">B</panel>
        </panel>
      </window>
    `,
    css: `
      #root { display: flex; flex-direction: row; align-items: start; }
      #cluster { display: flex; flex-direction: row; width: auto; gap: 3; }
      #a { width: 4; height: 1; }
      #b { width: 5; height: 1; }
      #gone { display: none; width: 40; }
      #float { position: absolute; width: 30; }
    `,
    bounds: { column: 0, row: 0, width: 40, height: 8 },
  });

  assertEquals(result.layout.byId.get("cluster")!.rect.width, 12);
});

Deno.test("simple layout solver intrinsic cache keys include flow-affecting style", () => {
  const cache = new LayoutMeasurementCache();
  const solver = simpleLayoutSolver({ intrinsicMeasurementCache: cache });
  const rootStyle = defaultComputedLayoutStyle();
  const cardStyle = defaultComputedLayoutStyle();
  const childStyle = defaultComputedLayoutStyle();
  childStyle.height = { unit: "cell", value: 1 };

  const hiddenStyle = defaultComputedLayoutStyle();
  hiddenStyle.height = { unit: "cell", value: 9 };
  hiddenStyle.display = "none";

  const card = createLayoutNode({
    id: "card",
    tag: "panel",
    style: cardStyle,
    children: [
      createLayoutNode({ id: "a", tag: "panel", text: "A", style: childStyle }),
      createLayoutNode({ id: "hidden", tag: "panel", text: "Hidden", style: hiddenStyle }),
      createLayoutNode({ id: "b", tag: "panel", text: "B", style: childStyle }),
    ],
  });
  const root = createLayoutNode({ id: "root", tag: "window", style: rootStyle, children: [card] });

  const first = solver.solve({ root, bounds: { column: 0, row: 0, width: 30, height: 20 } });
  const afterFirst = cache.stats();
  card.style.gap = 3;
  card.children[1]!.style.display = "block";
  const second = solver.solve({ root, bounds: { column: 0, row: 0, width: 30, height: 20 } });
  const afterSecond = cache.stats();

  assert(afterSecond.misses > afterFirst.misses);
  assertEquals(first.byId.get("card")!.rect.height, 2);
  assertEquals(second.byId.get("card")!.rect.height, 17);
});

Deno.test("createMarkupLayout applies simple solver justify-content to flex rows", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="a">A</panel>
        <panel id="b">B</panel>
      </window>
    `,
    css: `
      window {
        display: flex;
        justify-content: center;
        align-items: start;
        width: 100%;
        height: 100%;
      }

      panel {
        width: 2;
        height: 1;
      }
    `,
    bounds: { column: 0, row: 0, width: 12, height: 3 },
  });

  assertEquals(result.layout.byId.get("a")!.rect, { column: 4, row: 0, width: 2, height: 1 });
  assertEquals(result.layout.byId.get("b")!.rect, { column: 6, row: 0, width: 2, height: 1 });
});

Deno.test("createMarkupLayout positions absolute children without affecting simple solver flow", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="flow">Flow</panel>
        <panel id="badge">Badge</panel>
      </window>
    `,
    css: `
      window {
        width: 100%;
        height: 100%;
      }

      #flow {
        height: 3;
      }

      #badge {
        position: absolute;
        top: 1;
        right: 2;
        width: 6;
        height: 2;
      }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
  });

  assertEquals(result.layout.byId.get("flow")!.rect, { column: 0, row: 0, width: 20, height: 3 });
  assertEquals(result.layout.byId.get("badge")!.rect, { column: 12, row: 1, width: 6, height: 2 });
});

Deno.test("createHtmlCssLayoutDemo drives wrapped flex and absolute portfolio boxes", () => {
  const result = createHtmlCssLayoutDemo({ column: 0, row: 0, width: 44, height: 18 });

  const stage = result.layout.byId.get("layout-stage")!;
  const cpu = result.layout.byId.get("metric-cpu")!;
  const gpu = result.layout.byId.get("metric-gpu")!;
  const net = result.layout.byId.get("metric-net")!;
  const badge = result.layout.byId.get("layout-badge")!;
  const grid = result.layout.byId.get("layout-grid")!;
  const gridShell = result.layout.byId.get("grid-shell")!;
  const gridWorker = result.layout.byId.get("grid-worker")!;

  assertEquals(stage.rect.width > 0, true);
  assertEquals(cpu.rect.row, gpu.rect.row);
  assertEquals(cpu.rect.width, 16);
  assertEquals(gpu.rect.width, 14);
  assertEquals(net.rect.row > cpu.rect.row, true);
  assertEquals(grid.rect.width, stage.contentRect.width);
  assertEquals(gridShell.rect.row, grid.rect.row);
  assertEquals(gridWorker.rect.row > gridShell.rect.row, true);
  assertEquals(badge.rect.column + badge.rect.width, stage.contentRect.column + stage.contentRect.width - 1);
  assertEquals(badge.rect.row, stage.contentRect.row + 1);
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
  assertEquals(logs.inspectOverflow().columns.contentLength, 120);
  assertEquals(logs.inspectOverflow().rows.contentLength, 40);
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

Deno.test("hydrateMarkupWidgets orders focusable controls by tabindex", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <button id="doc-a">A</button>
        <button id="skip" tabindex="-1">Skip</button>
        <input id="third" tabindex="3" />
        <button id="first" tabindex="1">First</button>
        <input id="doc-b" tabindex="0" />
        <button id="second" tabindex="2">Second</button>
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
    bounds: { column: 0, row: 0, width: 40, height: 10 },
  });

  assertEquals(result.widgets.inspect().focusOrder, ["first", "second", "third", "doc-a", "doc-b"]);
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

Deno.test("yogaLayoutSolver accepts wrapped flex rows through the markup API", () => {
  const result = createMarkupLayout({
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
    solver: yogaLayoutSolver(),
  });

  assertEquals(result.layout.byId.get("a")!.rect, { column: 0, row: 0, width: 4, height: 1 });
  assertEquals(result.layout.byId.get("b")!.rect, { column: 5, row: 0, width: 4, height: 1 });
  assertEquals(result.layout.byId.get("c")!.rect, { column: 0, row: 2, width: 4, height: 1 });
});

Deno.test("yogaLayoutSolver positions absolute children through the markup API", () => {
  const result = createMarkupLayout({
    markup: `
      <window id="main">
        <panel id="flow">Flow</panel>
        <panel id="badge">Badge</panel>
      </window>
    `,
    css: `
      window {
        width: 100%;
        height: 100%;
      }

      #flow {
        height: 3;
      }

      #badge {
        position: absolute;
        top: 1;
        right: 2;
        width: 6;
        height: 2;
      }
    `,
    bounds: { column: 0, row: 0, width: 20, height: 10 },
    solver: yogaLayoutSolver(),
  });

  assertEquals(result.layout.byId.get("flow")!.rect, { column: 0, row: 0, width: 20, height: 3 });
  assertEquals(result.layout.byId.get("badge")!.rect, { column: 12, row: 1, width: 6, height: 2 });
});

function findLayoutNode(node: LayoutNode, id: string): LayoutNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findLayoutNode(child, id);
    if (found) return found;
  }
  return undefined;
}
