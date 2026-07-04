import { HTML_CSS_LAYOUT_OPTION_ID, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import {
  createWorkbenchVisualizationWindowOptions,
  type WorkbenchVisualizationOptionSource,
  type WorkbenchWindowOption,
} from "../src/app/workbench_window_registry.ts";

export const TERMINAL_OUTPUT_WINDOW_ID = "terminalOutput";
export const TERMINAL_OUTPUT_OPTION_ID = "terminal-output";
export const TERMINAL_SHELL_WINDOW_ID = "terminalShell";
export const TERMINAL_SHELL_OPTION_ID = "terminal-shell";

export type ApiWorkbenchBuiltInWindowId =
  | "explorer"
  | "inspector"
  | "data"
  | "controls"
  | "logs"
  | "three"
  | typeof HTML_CSS_LAYOUT_WINDOW_ID
  | typeof TERMINAL_OUTPUT_WINDOW_ID
  | typeof TERMINAL_SHELL_WINDOW_ID;

export interface ApiWorkbenchWindowCatalog {
  builtInWindowOrder: readonly ApiWorkbenchBuiltInWindowId[];
  htmlCssLayoutWindowOption: WorkbenchWindowOption;
  terminalOutputWindowOption: WorkbenchWindowOption;
  terminalShellWindowOption: WorkbenchWindowOption;
  visualizationWindowOptions: WorkbenchWindowOption[];
  visualizationWindowOptionIds: string[];
  visualizationWindowOptionById: Map<string, WorkbenchWindowOption>;
  newWindowOptions: WorkbenchWindowOption[];
}

export const apiWorkbenchBuiltInWindowOrder: readonly ApiWorkbenchBuiltInWindowId[] = [
  "explorer",
  "inspector",
  "data",
  "controls",
  "logs",
  "three",
  HTML_CSS_LAYOUT_WINDOW_ID,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_WINDOW_ID,
];

export const apiWorkbenchHtmlCssLayoutWindowOption: WorkbenchWindowOption = {
  id: HTML_CSS_LAYOUT_OPTION_ID,
  label: "HTML/CSS Layout",
  group: "Layout",
  description: "Renderer-neutral markup, CSS cascade, wrapped flex boxes, and absolute positioning.",
  windowId: HTML_CSS_LAYOUT_WINDOW_ID,
};

export const apiWorkbenchTerminalOutputWindowOption: WorkbenchWindowOption = {
  id: TERMINAL_OUTPUT_OPTION_ID,
  label: "Terminal Output",
  group: "Terminal",
  description: "Run a subprocess inside a managed workbench window with stdout/stderr scrollback.",
  windowId: TERMINAL_OUTPUT_WINDOW_ID,
};

export const apiWorkbenchTerminalShellWindowOption: WorkbenchWindowOption = {
  id: TERMINAL_SHELL_OPTION_ID,
  label: "Shell",
  group: "Terminal",
  description: "Open an interactive PTY-backed shell using the host OS shell.",
  windowId: TERMINAL_SHELL_WINDOW_ID,
};

export function createApiWorkbenchWindowCatalog(
  visualizations: readonly WorkbenchVisualizationOptionSource[],
): ApiWorkbenchWindowCatalog {
  const visualizationWindowOptions = createWorkbenchVisualizationWindowOptions(visualizations);
  const visualizationWindowOptionIds = new Array<string>(visualizationWindowOptions.length);
  const visualizationWindowOptionById = new Map<string, WorkbenchWindowOption>();
  for (let index = 0; index < visualizationWindowOptions.length; index += 1) {
    const option = visualizationWindowOptions[index]!;
    visualizationWindowOptionIds[index] = option.id;
    visualizationWindowOptionById.set(option.id, option);
  }
  return {
    builtInWindowOrder: apiWorkbenchBuiltInWindowOrder,
    htmlCssLayoutWindowOption: apiWorkbenchHtmlCssLayoutWindowOption,
    terminalOutputWindowOption: apiWorkbenchTerminalOutputWindowOption,
    terminalShellWindowOption: apiWorkbenchTerminalShellWindowOption,
    visualizationWindowOptions,
    visualizationWindowOptionIds,
    visualizationWindowOptionById,
    newWindowOptions: [
      apiWorkbenchTerminalShellWindowOption,
      apiWorkbenchTerminalOutputWindowOption,
      apiWorkbenchHtmlCssLayoutWindowOption,
      ...visualizationWindowOptions,
    ],
  };
}
