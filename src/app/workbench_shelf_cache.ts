// Copyright 2023 Im-Beast. MIT license.
import {
  createWorkbenchShelfLayoutBuffers,
  type WorkbenchShelfLayoutBuffers,
  type WorkbenchShelfRenderCommand,
  type WorkbenchShelfSource,
  type WorkbenchTabSource,
} from "./workbench_shelf.ts";

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
