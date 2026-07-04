import { assertEquals } from "./deps.ts";
import { createThreeAsciiComputeDispatchPlan } from "../src/three_ascii/compute_plan.ts";

Deno.test("createThreeAsciiComputeDispatchPlan omits edge pass for block/fill-only modes", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 40,
      rows: 24,
      workgroupSize: 8,
      includeEdges: false,
    }),
    {
      workgroupsX: 5,
      workgroupsY: 3,
      passes: [
        { kind: "fill", label: "deno_tui.three_ascii.fill" },
        { kind: "color", label: "deno_tui.three_ascii.color" },
      ],
    },
  );
});

Deno.test("createThreeAsciiComputeDispatchPlan includes edge pass between fill and color", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 41,
      rows: 25,
      workgroupSize: 8,
      includeEdges: true,
    }),
    {
      workgroupsX: 6,
      workgroupsY: 4,
      passes: [
        { kind: "fill", label: "deno_tui.three_ascii.fill" },
        { kind: "edge", label: "deno_tui.three_ascii.edge" },
        { kind: "color", label: "deno_tui.three_ascii.color" },
      ],
    },
  );
});

Deno.test("createThreeAsciiComputeDispatchPlan clamps invalid dimensions", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 0,
      rows: -4,
      workgroupSize: 0,
      includeEdges: false,
    }).workgroupsX,
    1,
  );
});
