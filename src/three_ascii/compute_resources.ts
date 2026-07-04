export interface ThreeAsciiComputeResourcePlanInput {
  columns: number;
  rows: number;
  includeFill?: boolean;
  includeEdges: boolean;
  includeDepthColor: boolean;
  currentCellCount: number;
  hasFillOutput?: boolean;
  hasFillBindGroup?: boolean;
  hasEdgeOutput: boolean;
  hasEdgeBindGroup: boolean;
  hasDepthColorBindGroup: boolean;
}

export interface ThreeAsciiComputeResourcePlan {
  cellCount: number;
  fillByteLength: number;
  colorByteLength: number;
  edgeByteLength: number;
  resizeOutputs: boolean;
  ensureFillOutput: boolean;
  releaseFillOutput: boolean;
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
  clearFillBindGroup: boolean;
  clearEdgeBindGroup: boolean;
}

export function createThreeAsciiComputeResourcePlan(
  input: ThreeAsciiComputeResourcePlanInput,
): ThreeAsciiComputeResourcePlan {
  const columns = Math.max(1, Math.floor(input.columns));
  const rows = Math.max(1, Math.floor(input.rows));
  const includeFill = input.includeFill ?? true;
  const cellCount = columns * rows;
  const resizeOutputs = cellCount !== Math.max(0, Math.floor(input.currentCellCount));
  const ensureFillOutput = includeFill;
  const releaseFillOutput = !includeFill && !!input.hasFillOutput;
  const ensureEdgeOutput = input.includeEdges;
  const releaseEdgeOutput = !input.includeEdges && input.hasEdgeOutput;
  const fillSetupDirty = includeFill && (!input.hasFillOutput || !input.hasFillBindGroup);
  const edgeSetupDirty = input.includeEdges && (!input.hasEdgeOutput || !input.hasEdgeBindGroup);
  const colorSetupDirty = input.includeDepthColor !== input.hasDepthColorBindGroup;
  return {
    cellCount,
    fillByteLength: includeFill ? cellCount * Float32Array.BYTES_PER_ELEMENT : 0,
    colorByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    edgeByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    resizeOutputs,
    ensureFillOutput,
    releaseFillOutput,
    ensureEdgeOutput,
    releaseEdgeOutput,
    dirty: resizeOutputs || fillSetupDirty || releaseFillOutput || edgeSetupDirty || releaseEdgeOutput ||
      colorSetupDirty,
  };
}

export function applyThreeAsciiComputeResourcePlanState(
  state: ThreeAsciiComputeResourceStateInput,
  plan: ThreeAsciiComputeResourcePlan,
): ThreeAsciiComputeResourceStateResult {
  return {
    outputCellCount: plan.resizeOutputs ? plan.cellCount : Math.max(0, Math.floor(state.currentCellCount)),
    computeDirty: state.computeDirty || plan.dirty,
    clearFillBindGroup: plan.releaseFillOutput,
    clearEdgeBindGroup: plan.releaseEdgeOutput,
  };
}
