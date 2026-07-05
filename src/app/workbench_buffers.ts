// Copyright 2023 Im-Beast. MIT license.
import type {
  WorkbenchButtonRowItem,
  WorkbenchButtonRowPlacement,
  WorkbenchButtonRowRenderCommand,
} from "./workbench_control_layout.ts";
import type { WorkbenchModalRowRenderCommand } from "./workbench_overlay.ts";
import {
  createWorkbenchShelfLayoutBuffers,
  type WorkbenchShelfLayoutBuffers,
  type WorkbenchShelfRenderCommand,
  type WorkbenchShelfSource,
  type WorkbenchTabSource,
} from "./workbench_shelf.ts";
import type {
  WorkbenchTerminalCopyRowProjection,
  WorkbenchTerminalPaneProjection,
  WorkbenchTerminalPaneTitleRenderCommand,
  WorkbenchTerminalSessionTab,
  WorkbenchTerminalSessionTabPlacement,
  WorkbenchTerminalSessionTabRenderCommand,
} from "./workbench_terminal.ts";
import { createWorkbenchTitlebarLayout, type WorkbenchTitlebarLayout } from "./workbench_titlebar.ts";
import type { WorkbenchTitlebarButtonRenderCommand } from "./workbench_titlebar.ts";

/** Retained storage for a renderer-neutral workbench button row. */
export class WorkbenchButtonRowBufferCache<TAction = string> {
  readonly items: WorkbenchButtonRowItem<TAction>[] = [];
  readonly placements: WorkbenchButtonRowPlacement<TAction>[] = [];
  readonly commands: WorkbenchButtonRowRenderCommand<TAction>[] = [];

  clear(): void {
    this.items.length = 0;
    this.placements.length = 0;
    this.commands.length = 0;
  }

  inspect(): WorkbenchButtonRowBufferCacheInspection {
    return {
      items: this.items.length,
      placements: this.placements.length,
      commands: this.commands.length,
    };
  }
}

export interface WorkbenchButtonRowBufferCacheInspection {
  items: number;
  placements: number;
  commands: number;
}

/** Retained buffers shared by workbench modal overlay renderers. */
export class WorkbenchModalBufferCache<Action = number> {
  /** Reusable row render-command buffer for modal title/body/action rows. */
  readonly rowCommands: WorkbenchModalRowRenderCommand[] = [];

  /** Reusable modal action button descriptors. */
  readonly actionItems: WorkbenchButtonRowItem<Action>[] = [];

  /** Reusable modal action button placements. */
  readonly actionPlacements: WorkbenchButtonRowPlacement<Action>[] = [];

  /** Reusable modal action button paint commands. */
  readonly actionCommands: WorkbenchButtonRowRenderCommand<Action>[] = [];

  /** Clears retained buffers without replacing their array identities. */
  clear(): void {
    this.rowCommands.length = 0;
    this.actionItems.length = 0;
    this.actionPlacements.length = 0;
    this.actionCommands.length = 0;
  }

  /** Reports retained buffer sizes for diagnostics and tests. */
  inspect(): { rowCommands: number; actionItems: number; actionPlacements: number; actionCommands: number } {
    return {
      rowCommands: this.rowCommands.length,
      actionItems: this.actionItems.length,
      actionPlacements: this.actionPlacements.length,
      actionCommands: this.actionCommands.length,
    };
  }
}

/** Reusable shelf/tab projection storage shared by terminal and browser workbench hosts. */
export class WorkbenchShelfBufferCache<TId extends string = string> {
  readonly entries: WorkbenchShelfSource<TId>[] = [];
  readonly tabs: WorkbenchTabSource<TId>[] = [];
  readonly shelfLayout: WorkbenchShelfLayoutBuffers<TId> = createWorkbenchShelfLayoutBuffers<TId>();
  readonly tabLayout: WorkbenchShelfLayoutBuffers<TId> = createWorkbenchShelfLayoutBuffers<TId>();
  readonly shelfCommands: WorkbenchShelfRenderCommand<TId>[] = [];
  readonly tabCommands: WorkbenchShelfRenderCommand<TId>[] = [];

  clear(): void {
    this.entries.length = 0;
    this.tabs.length = 0;
    this.shelfLayout.buttons.length = 0;
    this.shelfLayout.items.length = 0;
    this.shelfLayout.placements.length = 0;
    this.tabLayout.buttons.length = 0;
    this.tabLayout.items.length = 0;
    this.tabLayout.placements.length = 0;
    this.shelfCommands.length = 0;
    this.tabCommands.length = 0;
  }

  inspect(): WorkbenchShelfBufferCacheInspection {
    return {
      entries: this.entries.length,
      tabs: this.tabs.length,
      shelfButtons: this.shelfLayout.buttons.length,
      shelfItems: this.shelfLayout.items.length,
      shelfPlacements: this.shelfLayout.placements.length,
      tabButtons: this.tabLayout.buttons.length,
      tabItems: this.tabLayout.items.length,
      tabPlacements: this.tabLayout.placements.length,
      shelfCommands: this.shelfCommands.length,
      tabCommands: this.tabCommands.length,
    };
  }
}

export interface WorkbenchShelfBufferCacheInspection {
  entries: number;
  tabs: number;
  shelfButtons: number;
  shelfItems: number;
  shelfPlacements: number;
  tabButtons: number;
  tabItems: number;
  tabPlacements: number;
  shelfCommands: number;
  tabCommands: number;
}

/** Retained storage for terminal pane and copy-mode row projection. */
export class WorkbenchTerminalBufferCache {
  readonly paneProjections: WorkbenchTerminalPaneProjection[] = [];
  readonly paneTitleCommands: WorkbenchTerminalPaneTitleRenderCommand[] = [];
  readonly copyRows: WorkbenchTerminalCopyRowProjection[] = [];

  clear(): void {
    this.paneProjections.length = 0;
    this.paneTitleCommands.length = 0;
    this.copyRows.length = 0;
  }

  inspect(): WorkbenchTerminalBufferCacheInspection {
    return {
      paneProjections: this.paneProjections.length,
      paneTitleCommands: this.paneTitleCommands.length,
      copyRows: this.copyRows.length,
    };
  }
}

export interface WorkbenchTerminalBufferCacheInspection {
  paneProjections: number;
  paneTitleCommands: number;
  copyRows: number;
}

/** Retained storage for workbench terminal session-tab projection. */
export class WorkbenchTerminalSessionTabBufferCache {
  readonly sources: WorkbenchTerminalSessionTab[] = [];
  readonly placements: WorkbenchTerminalSessionTabPlacement[] = [];
  readonly commands: WorkbenchTerminalSessionTabRenderCommand[] = [];

  clear(): void {
    this.sources.length = 0;
    this.placements.length = 0;
    this.commands.length = 0;
  }

  inspect(): WorkbenchTerminalSessionTabBufferCacheInspection {
    return {
      sources: this.sources.length,
      placements: this.placements.length,
      commands: this.commands.length,
    };
  }
}

export interface WorkbenchTerminalSessionTabBufferCacheInspection {
  sources: number;
  placements: number;
  commands: number;
}

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
