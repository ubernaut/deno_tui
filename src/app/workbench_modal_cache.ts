// Copyright 2023 Im-Beast. MIT license.
import type {
  WorkbenchButtonRowItem,
  WorkbenchButtonRowPlacement,
  WorkbenchButtonRowRenderCommand,
} from "./workbench_control_layout.ts";
import type { WorkbenchModalRowRenderCommand } from "./workbench_overlay.ts";

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
