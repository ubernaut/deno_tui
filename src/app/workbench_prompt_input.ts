// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../utils/strings.ts";

/** Minimal key event shape for shared single-line workbench prompt editors. */
export interface WorkbenchTextPromptInputEvent {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
}

/** Action selected by {@link applyWorkbenchTextPromptInput}. */
export type WorkbenchTextPromptInputAction = "ignore" | "cancel" | "submit" | "update";

/** Options for applying one key event to a single-line prompt draft. */
export interface WorkbenchTextPromptInputOptions {
  event: WorkbenchTextPromptInputEvent;
  value: string;
  maxLength?: number;
  measureText?: (text: string) => number;
}

/** Result of applying one key event to a single-line prompt draft. */
export interface WorkbenchTextPromptInputResult {
  action: WorkbenchTextPromptInputAction;
  value: string;
}

/** Applies common Escape/Backspace/Return/printable-key behavior for workbench text prompts. */
export function applyWorkbenchTextPromptInput(
  options: WorkbenchTextPromptInputOptions,
): WorkbenchTextPromptInputResult {
  const event = options.event;
  const value = options.value;
  if (event.ctrl || event.meta) return { action: "ignore", value };
  if (event.key === "escape") return { action: "cancel", value };
  if (event.key === "backspace") return { action: "update", value: value.slice(0, -1) };
  if (event.key === "return") return { action: "submit", value };
  if (event.key.length === 1 && (options.measureText ?? textWidth)(event.key) === 1) {
    return {
      action: "update",
      value: `${value}${event.key}`.slice(0, Math.max(0, Math.floor(options.maxLength ?? 80))),
    };
  }
  return { action: "ignore", value };
}
