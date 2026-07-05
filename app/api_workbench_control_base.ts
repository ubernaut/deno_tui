export const apiWorkbenchControlIds = [
  "button",
  "genericButton",
  "modal",
  "slider",
  "checkbox",
  "radio",
  "combo",
  "dropdown",
  "input",
  "stepper",
  "textbox",
] as const;

export type ApiWorkbenchControlId = typeof apiWorkbenchControlIds[number];

export type ApiWorkbenchControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";

export interface ApiWorkbenchControlHitPlacement {
  column: number;
  row: number;
  width: number;
  height: number;
  id: ApiWorkbenchControlId;
  action: ApiWorkbenchControlHitAction;
  index?: number;
}
