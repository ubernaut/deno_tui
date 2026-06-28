import { assertEquals } from "./deps.ts";
import { layoutRecipeSlots, resolveLayoutRecipe, type ResponsiveLayoutRecipe } from "../src/layout/mod.ts";

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
