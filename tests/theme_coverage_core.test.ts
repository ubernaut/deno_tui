import { assertEquals, assertRejects } from "./deps.ts";
import { inspectThemeCoverageCore } from "../src/theme_coverage_core.ts";

Deno.test("theme coverage core reports inherited component and variant state coverage", () => {
  const coverage = inspectThemeCoverageCore({
    Field: {
      base: { base: "base", focused: "focused" },
    },
    Button: {
      extends: "Field",
      variants: {
        danger: { active: "active", disabled: "disabled" },
      },
    },
  }, {
    states: ["base", "focused", "active", "disabled"],
    components: ["Button", "Field", "Missing"],
  });

  assertEquals(coverage, {
    componentCount: 3,
    variantCount: 4,
    stateCount: 16,
    coveredStateCount: 8,
    missingStateCount: 8,
    complete: false,
    components: [
      {
        name: "Button",
        extends: ["Field"],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
          { name: "danger", states: ["base", "focused", "active", "disabled"], missingStates: [], complete: true },
        ],
        stateCount: 8,
        coveredStateCount: 6,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Field",
        extends: [],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
        ],
        stateCount: 4,
        coveredStateCount: 2,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Missing",
        extends: [],
        variants: [
          { name: "default", states: [], missingStates: ["base", "focused", "active", "disabled"], complete: false },
        ],
        stateCount: 4,
        coveredStateCount: 0,
        missingStateCount: 4,
        complete: false,
      },
    ],
  });
});

Deno.test("theme coverage core supports custom variant enumeration and injected cycle errors", async () => {
  const coverage = inspectThemeCoverageCore({
    Button: {
      variants: { danger: { base: "base" } },
    },
  }, {
    states: ["base"],
    variants: () => ["quiet"],
  });

  assertEquals(coverage.components[0]?.variants.map((variant) => variant.name), ["default", "quiet"]);

  await assertRejects(
    async () =>
      inspectThemeCoverageCore({
        A: { extends: "B" },
        B: { extends: "A" },
      }, {
        states: ["base"],
        createInheritanceError: (cycle) => new TypeError(cycle.join(">")),
      }),
    TypeError,
    "A>B>A",
  );
});
