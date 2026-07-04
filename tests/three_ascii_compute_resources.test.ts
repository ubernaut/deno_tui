import { assertEquals } from "./deps.ts";
import { createThreeAsciiComputeResourcePlan } from "../src/three_ascii/compute_resources.ts";

Deno.test("createThreeAsciiComputeResourcePlan sizes fill color and edge buffers", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 12,
      rows: 8,
      includeEdges: true,
      currentCellCount: 0,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
    }),
    {
      cellCount: 96,
      fillByteLength: 384,
      colorByteLength: 1536,
      edgeByteLength: 1536,
      resizeOutputs: true,
      ensureEdgeOutput: true,
      releaseEdgeOutput: false,
      dirty: true,
    },
  );
});

Deno.test("createThreeAsciiComputeResourcePlan keeps stable no-edge resources clean", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 10,
      rows: 5,
      includeEdges: false,
      currentCellCount: 50,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
    }).dirty,
    false,
  );
});

Deno.test("createThreeAsciiComputeResourcePlan marks edge release dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeEdges: false,
    currentCellCount: 50,
    hasEdgeOutput: true,
    hasEdgeBindGroup: true,
  });

  assertEquals(plan.releaseEdgeOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks missing edge bind group dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeEdges: true,
    currentCellCount: 50,
    hasEdgeOutput: true,
    hasEdgeBindGroup: false,
  });

  assertEquals(plan.resizeOutputs, false);
  assertEquals(plan.ensureEdgeOutput, true);
  assertEquals(plan.dirty, true);
});
