import { assertEquals } from "./deps.ts";
import {
  applyThreeAsciiComputeResourcePlanState,
  createThreeAsciiComputeResourcePlan,
} from "../src/three_ascii/compute_resources.ts";

Deno.test("createThreeAsciiComputeResourcePlan sizes fill color and edge buffers", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 12,
      rows: 8,
      includeFill: true,
      includeEdges: true,
      includeDepthColor: true,
      currentCellCount: 0,
      hasFillOutput: false,
      hasFillBindGroup: false,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }),
    {
      cellCount: 96,
      fillByteLength: 384,
      colorByteLength: 1536,
      edgeByteLength: 1536,
      resizeOutputs: true,
      ensureFillOutput: true,
      releaseFillOutput: false,
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
      includeFill: true,
      includeEdges: false,
      includeDepthColor: false,
      currentCellCount: 50,
      hasFillOutput: true,
      hasFillBindGroup: true,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }).dirty,
    false,
  );
});

Deno.test("createThreeAsciiComputeResourcePlan marks edge release dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: true,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.releaseEdgeOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks fill release dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: false,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.fillByteLength, 0);
  assertEquals(plan.ensureFillOutput, false);
  assertEquals(plan.releaseFillOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks missing edge bind group dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: true,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.resizeOutputs, false);
  assertEquals(plan.ensureEdgeOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks depth color mode switches dirty", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 10,
      rows: 5,
      includeFill: true,
      includeEdges: false,
      includeDepthColor: true,
      currentCellCount: 50,
      hasFillOutput: true,
      hasFillBindGroup: true,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }).dirty,
    true,
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState preserves stable clean resources", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 50, computeDirty: false, clearFillBindGroup: false, clearEdgeBindGroup: false },
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState marks resized outputs dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 12,
    rows: 8,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 96, computeDirty: true, clearFillBindGroup: false, clearEdgeBindGroup: false },
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState clears stale edge bind groups", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: true,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 50, computeDirty: true, clearFillBindGroup: false, clearEdgeBindGroup: true },
  );
});
