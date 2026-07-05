import { type ApiWorkbenchControlId, apiWorkbenchControlIds } from "./api_workbench_control_base.ts";

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

export function apiWorkbenchControlAt(
  current: ApiWorkbenchControlId,
  delta: number,
  fallback: ApiWorkbenchControlId = "button",
): ApiWorkbenchControlId {
  return nextApiWorkbenchControlId(current, delta, { wrap: true }) ?? fallback;
}

export function apiWorkbenchControlAtEdge(
  current: ApiWorkbenchControlId,
  delta: number,
): ApiWorkbenchControlId | undefined {
  return nextApiWorkbenchControlId(current, delta);
}

export function isApiWorkbenchTextControlActive(
  activeWindowId: string | undefined,
  controlsWindowId: string,
  activeControl: ApiWorkbenchControlId,
): boolean {
  return activeWindowId === controlsWindowId && (activeControl === "input" || activeControl === "textbox");
}
