// Copyright 2023 Im-Beast. MIT license.
import type {
  WorkbenchTerminalSessionTab,
  WorkbenchTerminalSessionTabPlacement,
  WorkbenchTerminalSessionTabRenderCommand,
} from "./workbench_terminal.ts";

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
