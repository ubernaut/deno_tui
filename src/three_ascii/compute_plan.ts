export interface ThreeAsciiComputePassPlan {
  readonly kind: "fill" | "edge" | "color";
  readonly label: string;
}

export interface ThreeAsciiComputeDispatchPlan {
  readonly workgroupsX: number;
  readonly workgroupsY: number;
  readonly passes: readonly ThreeAsciiComputePassPlan[];
}

const FILL_PASS: ThreeAsciiComputePassPlan = {
  kind: "fill",
  label: "deno_tui.three_ascii.fill",
};
const EDGE_PASS: ThreeAsciiComputePassPlan = {
  kind: "edge",
  label: "deno_tui.three_ascii.edge",
};
const COLOR_PASS: ThreeAsciiComputePassPlan = {
  kind: "color",
  label: "deno_tui.three_ascii.color",
};

const FILL_COLOR_PASSES = [FILL_PASS, COLOR_PASS] as const;
const FILL_EDGE_COLOR_PASSES = [FILL_PASS, EDGE_PASS, COLOR_PASS] as const;

export function createThreeAsciiComputeDispatchPlan(options: {
  columns: number;
  rows: number;
  workgroupSize: number;
  includeEdges: boolean;
}): ThreeAsciiComputeDispatchPlan {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const workgroupSize = Math.max(1, Math.floor(options.workgroupSize));
  return {
    workgroupsX: Math.ceil(columns / workgroupSize),
    workgroupsY: Math.ceil(rows / workgroupSize),
    passes: options.includeEdges ? FILL_EDGE_COLOR_PASSES : FILL_COLOR_PASSES,
  };
}
