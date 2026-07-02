// Copyright 2023 Im-Beast. MIT license.
import {
  createKittyGraphicsSurface,
  type GraphicsSurface,
  type GraphicsSurfaceWriter,
} from "../src/runtime/graphics_surface.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import type { KittyGraphicsCapability } from "../src/runtime/kitty_graphics.ts";

export interface TmuxPassthroughProbeResult {
  success: boolean;
  stdout: Uint8Array;
}

export interface DetectTmuxPassthroughOptions {
  tmux?: string | null;
  command?: () => Promise<TmuxPassthroughProbeResult>;
  decoder?: TextDecoder;
}

export interface WorkbenchKittyGraphicsControllerOptions {
  writer: GraphicsSurfaceWriter;
  diagnostics?: DiagnosticsCollector;
  capability?: KittyGraphicsCapability;
  tmux?: string | null;
  tmuxPassthroughAllowed: boolean;
}

export interface CreateWorkbenchKittyGraphicsControllerOptions
  extends Omit<WorkbenchKittyGraphicsControllerOptions, "tmuxPassthroughAllowed"> {
  command?: DetectTmuxPassthroughOptions["command"];
}

export interface WorkbenchKittyGraphicsSelection {
  kittyGraphics?: boolean;
}

/** Detects whether the current tmux session permits Kitty graphics passthrough. */
export async function detectTmuxPassthroughAllowed(options: DetectTmuxPassthroughOptions = {}): Promise<boolean> {
  const tmux = options.tmux ?? Deno.env.get("TMUX");
  if (!tmux) return true;

  try {
    const output = await (options.command ?? defaultTmuxPassthroughCommand)();
    if (!output.success) return false;
    const value = (options.decoder ?? new TextDecoder()).decode(output.stdout).trim().toLowerCase();
    return value === "on" || value === "all" || value === "1" || value === "yes";
  } catch {
    return false;
  }
}

/** Owns the API Workbench auto and forced Kitty graphics surfaces. */
export class WorkbenchKittyGraphicsController {
  readonly tmux: string | null;
  readonly tmuxPassthroughAllowed: boolean;
  readonly autoSurface: GraphicsSurface;
  readonly forcedSurface: GraphicsSurface;

  static async create(
    options: CreateWorkbenchKittyGraphicsControllerOptions,
  ): Promise<WorkbenchKittyGraphicsController> {
    const tmux = options.tmux ?? Deno.env.get("TMUX") ?? null;
    const tmuxPassthroughAllowed = await detectTmuxPassthroughAllowed({ tmux, command: options.command });
    return new WorkbenchKittyGraphicsController({ ...options, tmux, tmuxPassthroughAllowed });
  }

  constructor(options: WorkbenchKittyGraphicsControllerOptions) {
    this.tmux = options.tmux ?? null;
    this.tmuxPassthroughAllowed = options.tmuxPassthroughAllowed;
    this.autoSurface = this.createSurface(options, false);
    this.forcedSurface = this.createSurface(options, true);
  }

  surfaceFor(options: WorkbenchKittyGraphicsSelection): GraphicsSurface {
    return options.kittyGraphics ? this.forcedSurface : this.autoSurface;
  }

  async clear(scope: "all" | "visible" = "visible"): Promise<void> {
    await Promise.all([
      this.autoSurface.clear(scope),
      this.forcedSurface.clear(scope),
    ]);
  }

  private createSurface(options: WorkbenchKittyGraphicsControllerOptions, force: boolean): GraphicsSurface {
    const canForce = force && (!this.tmux || this.tmuxPassthroughAllowed);
    return createKittyGraphicsSurface({
      writer: options.writer,
      capability: options.capability,
      detection: canForce && this.tmux ? { tmuxPassthrough: true } : undefined,
      force: canForce,
      quiet: 2,
      maxChunkBytes: 16384,
      diagnostics: options.diagnostics,
    });
  }
}

async function defaultTmuxPassthroughCommand(): Promise<TmuxPassthroughProbeResult> {
  return await new Deno.Command("tmux", {
    args: ["show-options", "-gqv", "allow-passthrough"],
  }).output();
}
