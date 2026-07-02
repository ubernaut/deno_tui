import { type ApiWorkbenchControlId, apiWorkbenchControlIds } from "./api_workbench_control_types.ts";

export * from "./api_workbench_control_line.ts";
export * from "./api_workbench_control_rows.ts";
export * from "./api_workbench_control_style.ts";
export * from "./api_workbench_control_types.ts";
export * from "./api_workbench_dropdown.ts";
export * from "./api_workbench_stepper.ts";
export * from "./api_workbench_table.ts";
export * from "./api_workbench_textbox.ts";
export * from "./api_workbench_wrapped_options.ts";

export function nextApiWorkbenchControlId(
  current: ApiWorkbenchControlId,
  delta: number,
  options: { wrap?: boolean } = {},
): ApiWorkbenchControlId | undefined {
  const index = apiWorkbenchControlIds.indexOf(current);
  if (index < 0) return options.wrap ? apiWorkbenchControlIds[0] : undefined;
  const next = index + delta;
  if (!options.wrap && (next < 0 || next >= apiWorkbenchControlIds.length)) return undefined;
  return apiWorkbenchControlIds[
    ((next % apiWorkbenchControlIds.length) + apiWorkbenchControlIds.length) %
    apiWorkbenchControlIds.length
  ];
}
