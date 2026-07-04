// Copyright 2023 Im-Beast. MIT license.
import type {
  WorkbenchTerminalCopyRowProjection,
  WorkbenchTerminalPaneProjection,
  WorkbenchTerminalPaneTitleRenderCommand,
} from "./workbench_terminal.ts";

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
