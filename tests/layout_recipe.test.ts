import { assertEquals } from "./deps.ts";
import {
  createLayoutRecipeController,
  formatLayoutRecipeMarkdown,
  inspectLayoutRecipe,
  layoutRecipeSlots,
  resolveLayoutRecipe,
  type ResponsiveLayoutRecipe,
} from "../src/layout/mod.ts";
import { Signal } from "../src/signals/mod.ts";

type SlotId = "header" | "nav" | "main" | "details" | "footer";

const recipe: ResponsiveLayoutRecipe<SlotId> = {
  breakpoints: [
    { id: "compact" },
    { id: "wide", minWidth: 100 },
  ],
  fallback: "compact",
  layouts: {
    compact: {
      dock: "top",
      size: 2,
      gap: 1,
      panel: { id: "header" },
      body: {
        dock: "bottom",
        size: 1,
        panel: { id: "footer" },
        body: { id: "main", inset: 1 },
      },
    },
    wide: {
      dock: "top",
      size: 2,
      gap: 1,
      panel: { id: "header" },
      body: {
        split: "row",
        ratio: 0.25,
        gap: 1,
        first: { id: "nav", minWidth: 10 },
        second: {
          split: "row",
          ratio: 0.7,
          gap: 1,
          first: { id: "main" },
          second: { id: "details", minWidth: 12 },
        },
      },
    },
  },
};

Deno.test("resolveLayoutRecipe maps breakpoint recipes into named rectangles", () => {
  const result = resolveLayoutRecipe({ column: 0, row: 0, width: 120, height: 30 }, recipe);

  assertEquals(result.breakpoint, "wide");
  assertEquals(result.rects.header, { column: 0, row: 0, width: 120, height: 2 });
  assertEquals(result.rects.nav, { column: 0, row: 3, width: 30, height: 27 });
  assertEquals(result.rects.main, { column: 31, row: 3, width: 62, height: 27 });
  assertEquals(result.rects.details, { column: 94, row: 3, width: 26, height: 27 });
});

Deno.test("resolveLayoutRecipe applies compact fallback and leaf insets", () => {
  const result = resolveLayoutRecipe({ column: 0, row: 0, width: 40, height: 12 }, recipe);

  assertEquals(result.breakpoint, "compact");
  assertEquals(result.rects.header, { column: 0, row: 0, width: 40, height: 2 });
  assertEquals(result.rects.footer, { column: 0, row: 11, width: 40, height: 1 });
  assertEquals(result.rects.main, { column: 1, row: 4, width: 38, height: 6 });
});

Deno.test("resolveLayoutRecipe omits hidden and undersized slots", () => {
  const result = resolveLayoutRecipe({ column: 0, row: 0, width: 80, height: 16 }, {
    breakpoints: [{ id: "default" }],
    layouts: {
      default: {
        split: "row",
        firstSize: 10,
        first: { id: "nav", hidden: true },
        second: { id: "details", minWidth: 100 },
      },
    },
  });

  assertEquals(result.rects, {});
});

Deno.test("layoutRecipeSlots lists visible leaf ids once", () => {
  assertEquals(layoutRecipeSlots(recipe.layouts.wide!), ["header", "nav", "main", "details"]);
});

Deno.test("inspectLayoutRecipe reports breakpoints slots and missing layouts", () => {
  const inspection = inspectLayoutRecipe({
    ...recipe,
    breakpoints: [...recipe.breakpoints, { id: "tall", minHeight: 40 }],
  });

  assertEquals(inspection, {
    breakpoints: [
      {
        id: "compact",
        minWidth: undefined,
        minHeight: undefined,
        hasLayout: true,
        slots: ["header", "footer", "main"],
      },
      { id: "wide", minWidth: 100, minHeight: undefined, hasLayout: true, slots: ["header", "nav", "main", "details"] },
      { id: "tall", minWidth: undefined, minHeight: 40, hasLayout: false, slots: [] },
    ],
    fallback: "compact",
    layoutIds: ["compact", "wide"],
    slotIds: ["details", "footer", "header", "main", "nav"],
    missingLayouts: ["tall"],
  });
});

Deno.test("formatLayoutRecipeMarkdown renders breakpoint coverage", () => {
  assertEquals(
    formatLayoutRecipeMarkdown({
      ...recipe,
      breakpoints: [...recipe.breakpoints, { id: "tall", minHeight: 40 }],
    }, { title: "Shell Layout" }),
    [
      "# Shell Layout",
      "",
      "Breakpoints: 3",
      "Layouts: compact, wide",
      "Slots: details, footer, header, main, nav",
      "Missing layouts: tall",
      "",
      "| Breakpoint | Min size | Layout | Slots |",
      "| --- | --- | --- | --- |",
      "| compact | default | yes | header, footer, main |",
      "| wide | w>=100 | yes | header, nav, main, details |",
      "| tall | h>=40 | no | none |",
    ].join("\n"),
  );
});

Deno.test("resolveLayoutRecipe falls back when breakpoint layout is missing", () => {
  const result = resolveLayoutRecipe({ column: 0, row: 0, width: 120, height: 10 }, {
    breakpoints: [{ id: "small" }, { id: "large", minWidth: 100 }],
    fallback: "small",
    layouts: {
      small: { id: "main" },
    },
  });

  assertEquals(result.breakpoint, "large");
  assertEquals(result.rects.main, { column: 0, row: 0, width: 120, height: 10 });
});

Deno.test("LayoutRecipeController tracks bounds and exposes computed rects", async () => {
  const bounds = new Signal({ column: 0, row: 0, width: 40, height: 12 });
  const controller = createLayoutRecipeController(bounds, recipe);
  const main = controller.rect("main");

  await Promise.resolve();

  assertEquals(controller.breakpoint.value, "compact");
  assertEquals(main.value, { column: 1, row: 4, width: 38, height: 6 });
  assertEquals(controller.inspect(), {
    breakpoint: "compact",
    rects: {
      header: { column: 0, row: 0, width: 40, height: 2 },
      footer: { column: 0, row: 11, width: 40, height: 1 },
      main: { column: 1, row: 4, width: 38, height: 6 },
    },
    slots: ["header", "footer", "main"],
  });

  controller.update({ column: 0, row: 0, width: 120, height: 30 });

  assertEquals(controller.breakpoint.value, "wide");
  assertEquals(main.value, { column: 31, row: 3, width: 62, height: 27 });
  assertEquals(controller.slots(), ["header", "nav", "main", "details"]);

  main.dispose();
  controller.dispose();
});
