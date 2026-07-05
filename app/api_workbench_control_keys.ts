import type { ApiWorkbenchControlHitAction, ApiWorkbenchControlId } from "./api_workbench_control_base.ts";

export interface ApiWorkbenchControlKeyEvent {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export type ApiWorkbenchControlKeyResolution =
  | { type: "textInput" }
  | { type: "focus"; delta: number }
  | { type: "control"; action: Extract<ApiWorkbenchControlHitAction, "previous" | "next" | "activate"> }
  | { type: "radio"; delta: number }
  | { type: "dropdown"; action: "move"; delta: number }
  | { type: "dropdown"; action: "first" | "last" | "close" | "select" }
  | { type: "none" };

export interface ResolveApiWorkbenchControlKeyOptions {
  dropdownExpanded?: boolean;
}

export function resolveApiWorkbenchControlKey(
  id: ApiWorkbenchControlId,
  event: ApiWorkbenchControlKeyEvent,
  options: ResolveApiWorkbenchControlKeyOptions = {},
): ApiWorkbenchControlKeyResolution {
  if (id === "input" || id === "textbox") return { type: "textInput" };
  if (id === "dropdown" && options.dropdownExpanded) {
    if (event.key === "up") return { type: "dropdown", action: "move", delta: -1 };
    if (event.key === "down") return { type: "dropdown", action: "move", delta: 1 };
    if (event.key === "home") return { type: "dropdown", action: "first" };
    if (event.key === "end") return { type: "dropdown", action: "last" };
    if (event.key === "escape") return { type: "dropdown", action: "close" };
    if (event.key === "return" || event.key === "space") return { type: "dropdown", action: "select" };
    if (event.key === "left") return { type: "control", action: "previous" };
    if (event.key === "right") return { type: "control", action: "next" };
    return { type: "none" };
  }
  if (id === "radio" && (event.key === "up" || event.key === "down")) {
    return { type: "radio", delta: event.key === "up" ? -1 : 1 };
  }
  if (event.key === "up") return { type: "focus", delta: -1 };
  if (event.key === "down") return { type: "focus", delta: 1 };
  if (event.key === "left") return { type: "control", action: "previous" };
  if (event.key === "right") return { type: "control", action: "next" };
  if (event.key === "space" || event.key === "return") return { type: "control", action: "activate" };
  return { type: "none" };
}
