export interface ThreeAsciiComputePassPlan {
  readonly kind: "fill" | "edge" | "color";
  readonly label: string;
}

export interface ThreeAsciiComputeDispatchPlan {
  readonly workgroupsX: number;
  readonly workgroupsY: number;
  readonly passes: readonly ThreeAsciiComputePassPlan[];
}

export interface ThreeAsciiComputeDispatchPlanInput {
  columns: number;
  rows: number;
  workgroupSize: number;
  includeEdges: boolean;
}

/** Reuses compute dispatch plan objects while render size and edge mode are unchanged. */
export class ThreeAsciiComputeDispatchPlanCache {
  private cached?: ThreeAsciiComputeDispatchPlan;
  private columns = -1;
  private rows = -1;
  private workgroupSize = -1;
  private includeEdges = false;

  resolve(options: ThreeAsciiComputeDispatchPlanInput): ThreeAsciiComputeDispatchPlan {
    const columns = Math.max(1, Math.floor(options.columns));
    const rows = Math.max(1, Math.floor(options.rows));
    const workgroupSize = Math.max(1, Math.floor(options.workgroupSize));
    if (
      this.cached &&
      this.columns === columns &&
      this.rows === rows &&
      this.workgroupSize === workgroupSize &&
      this.includeEdges === options.includeEdges
    ) {
      return this.cached;
    }

    this.columns = columns;
    this.rows = rows;
    this.workgroupSize = workgroupSize;
    this.includeEdges = options.includeEdges;
    this.cached = createThreeAsciiComputeDispatchPlan({
      columns,
      rows,
      workgroupSize,
      includeEdges: options.includeEdges,
    });
    return this.cached;
  }

  clear(): void {
    this.cached = undefined;
    this.columns = -1;
    this.rows = -1;
    this.workgroupSize = -1;
    this.includeEdges = false;
  }
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

export function createThreeAsciiComputeDispatchPlan(
  options: ThreeAsciiComputeDispatchPlanInput,
): ThreeAsciiComputeDispatchPlan {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const workgroupSize = Math.max(1, Math.floor(options.workgroupSize));
  return {
    workgroupsX: Math.ceil(columns / workgroupSize),
    workgroupsY: Math.ceil(rows / workgroupSize),
    passes: options.includeEdges ? FILL_EDGE_COLOR_PASSES : FILL_COLOR_PASSES,
  };
}
