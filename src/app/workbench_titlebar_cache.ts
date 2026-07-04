// Copyright 2023 Im-Beast. MIT license.
import { createWorkbenchTitlebarLayout, type WorkbenchTitlebarLayout } from "./workbench_titlebar.ts";
import type { WorkbenchTitlebarButtonRenderCommand } from "./workbench_titlebar.ts";

/** Retained titlebar layout and render-command buffers keyed by workbench window id. */
export class WorkbenchTitlebarBufferCache<Id extends string> {
  #layouts = new Map<Id, WorkbenchTitlebarLayout>();
  #renderCommands = new Map<Id, WorkbenchTitlebarButtonRenderCommand[]>();

  /** Returns the retained titlebar layout buffer for a window id. */
  layout(id: Id): WorkbenchTitlebarLayout {
    let layout = this.#layouts.get(id);
    if (!layout) {
      layout = createWorkbenchTitlebarLayout();
      this.#layouts.set(id, layout);
    }
    return layout;
  }

  /** Returns the retained titlebar button render-command buffer for a window id. */
  renderCommands(id: Id): WorkbenchTitlebarButtonRenderCommand[] {
    let commands = this.#renderCommands.get(id);
    if (!commands) {
      commands = [];
      this.#renderCommands.set(id, commands);
    }
    return commands;
  }

  /** Drops retained buffers for one window id. */
  delete(id: Id): void {
    this.#layouts.delete(id);
    this.#renderCommands.delete(id);
  }

  /** Drops all retained buffers. */
  clear(): void {
    this.#layouts.clear();
    this.#renderCommands.clear();
  }

  /** Reports retained cache sizes for diagnostics and tests. */
  inspect(): { layouts: number; renderCommands: number } {
    return {
      layouts: this.#layouts.size,
      renderCommands: this.#renderCommands.size,
    };
  }
}
