export interface ThreeAsciiComputeResourcePlanInput {
  columns: number;
  rows: number;
  includeEdges: boolean;
  currentCellCount: number;
  hasEdgeOutput: boolean;
  hasEdgeBindGroup: boolean;
}

export interface ThreeAsciiComputeResourcePlan {
  cellCount: number;
  fillByteLength: number;
  colorByteLength: number;
  edgeByteLength: number;
  resizeOutputs: boolean;
  ensureEdgeOutput: boolean;
  releaseEdgeOutput: boolean;
  dirty: boolean;
}

export interface ThreeAsciiComputeResourceStateInput {
  currentCellCount: number;
  computeDirty: boolean;
}

export interface ThreeAsciiComputeResourceStateResult {
  outputCellCount: number;
  computeDirty: boolean;
  clearEdgeBindGroup: boolean;
}

export function createThreeAsciiComputeResourcePlan(
  input: ThreeAsciiComputeResourcePlanInput,
): ThreeAsciiComputeResourcePlan {
  const columns = Math.max(1, Math.floor(input.columns));
  const rows = Math.max(1, Math.floor(input.rows));
  const cellCount = columns * rows;
  const resizeOutputs = cellCount !== Math.max(0, Math.floor(input.currentCellCount));
  const ensureEdgeOutput = input.includeEdges;
  const releaseEdgeOutput = !input.includeEdges && input.hasEdgeOutput;
  const edgeSetupDirty = input.includeEdges && (!input.hasEdgeOutput || !input.hasEdgeBindGroup);
  return {
    cellCount,
    fillByteLength: cellCount * Float32Array.BYTES_PER_ELEMENT,
    colorByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    edgeByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    resizeOutputs,
    ensureEdgeOutput,
    releaseEdgeOutput,
    dirty: resizeOutputs || edgeSetupDirty || releaseEdgeOutput,
  };
}

export function applyThreeAsciiComputeResourcePlanState(
  state: ThreeAsciiComputeResourceStateInput,
  plan: ThreeAsciiComputeResourcePlan,
): ThreeAsciiComputeResourceStateResult {
  return {
    outputCellCount: plan.resizeOutputs ? plan.cellCount : Math.max(0, Math.floor(state.currentCellCount)),
    computeDirty: state.computeDirty || plan.dirty,
    clearEdgeBindGroup: plan.releaseEdgeOutput,
  };
}
