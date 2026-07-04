// Copyright 2023 Im-Beast. MIT license.
import type {
  WorkbenchButtonRowItem,
  WorkbenchButtonRowPlacement,
  WorkbenchButtonRowRenderCommand,
} from "./workbench_control_layout.ts";

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
