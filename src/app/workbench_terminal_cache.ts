// Copyright 2023 Im-Beast. MIT license.
import type { WorkbenchTerminalCopyRowProjection, WorkbenchTerminalPaneProjection } from "./workbench_terminal.ts";

/** Retained storage for terminal pane and copy-mode row projection. */
export class WorkbenchTerminalBufferCache {
  readonly paneProjections: WorkbenchTerminalPaneProjection[] = [];
  readonly copyRows: WorkbenchTerminalCopyRowProjection[] = [];

  clear(): void {
    this.paneProjections.length = 0;
    this.copyRows.length = 0;
  }

  inspect(): WorkbenchTerminalBufferCacheInspection {
    return {
      paneProjections: this.paneProjections.length,
      copyRows: this.copyRows.length,
    };
  }
}

export interface WorkbenchTerminalBufferCacheInspection {
  paneProjections: number;
  copyRows: number;
}
