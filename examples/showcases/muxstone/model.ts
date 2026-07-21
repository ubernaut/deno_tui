// Copyright 2023 Im-Beast. MIT license.

import { defineShowcaseManifest } from "../shared/mod.ts";
import { grWizardThemePalettes } from "../../../src/grwizard_themes.ts";

/** Current Muxstone workspace metadata schema. Live PTYs remain daemon-owned. */
export const MUXSTONE_SESSION_SCHEMA_VERSION = 1 as const;

/** Upper bounds shared by the demo controller and its local host client. */
export const MUXSTONE_MAX_SESSIONS = 32;
export const MUXSTONE_MAX_COLUMNS = 512;
export const MUXSTONE_MAX_ROWS = 256;

const MUXSTONE_WORKBENCH_THEME_IDS = [
  "unit01",
  "arcane",
  "forge",
  "grove",
  "velvet",
  "section9",
  "parchment",
  "seaglass",
] as const;

/** Stable Workbench identities accepted by persisted Muxstone workspaces. */
export type MuxstoneWorkbenchThemeId = (typeof MUXSTONE_WORKBENCH_THEME_IDS)[number];

/** Stable theme identities persisted with the window layout. */
export type MuxstoneThemeId = "midnight" | "amber" | "matrix" | "paper" | MuxstoneWorkbenchThemeId | "t2";

/** RGB tuple used by the renderer without depending on terminal palette state. */
export type MuxstoneRgb = readonly [red: number, green: number, blue: number];

/** Six named T2 color families used to keep the theme deliberate and testable. */
export const MUXSTONE_T2_SWATCHES = {
  black: [3, 4, 8],
  charcoal: [24, 26, 34],
  darkBlue: [30, 58, 112],
  lightBlue: [205, 234, 255],
  darkPurple: [155, 115, 220],
  lightPurple: [220, 168, 255],
} as const satisfies Readonly<Record<string, MuxstoneRgb>>;

/** One complete Muxstone chrome/default-terminal theme. */
export interface MuxstoneThemeSpec {
  readonly id: MuxstoneThemeId;
  readonly label: string;
  readonly background: MuxstoneRgb;
  readonly surface: MuxstoneRgb;
  readonly surfaceStrong: MuxstoneRgb;
  readonly border: MuxstoneRgb;
  readonly text: MuxstoneRgb;
  readonly muted: MuxstoneRgb;
  readonly accent: MuxstoneRgb;
  readonly success: MuxstoneRgb;
  readonly warning: MuxstoneRgb;
  readonly danger: MuxstoneRgb;
}

/** Original Muxstone themes retained in stable order for persisted workspaces. */
const MUXSTONE_NATIVE_THEMES = [
  {
    id: "midnight",
    label: "Midnight Ops",
    background: [8, 12, 20],
    surface: [14, 21, 34],
    surfaceStrong: [24, 35, 54],
    border: [73, 101, 134],
    text: [224, 235, 246],
    muted: [132, 154, 178],
    accent: [76, 201, 240],
    success: [73, 209, 125],
    warning: [244, 190, 72],
    danger: [244, 104, 110],
  },
  {
    id: "amber",
    label: "Amber Glass",
    background: [20, 12, 2],
    surface: [37, 24, 7],
    surfaceStrong: [58, 39, 10],
    border: [145, 92, 21],
    text: [255, 220, 145],
    muted: [188, 137, 67],
    accent: [255, 174, 45],
    success: [182, 219, 82],
    warning: [255, 199, 80],
    danger: [255, 99, 71],
  },
  {
    id: "matrix",
    label: "Matrix Phosphor",
    background: [1, 13, 6],
    surface: [3, 25, 12],
    surfaceStrong: [6, 43, 20],
    border: [28, 112, 55],
    text: [156, 255, 173],
    muted: [72, 154, 91],
    accent: [45, 255, 96],
    success: [113, 255, 132],
    warning: [224, 241, 95],
    danger: [255, 91, 91],
  },
  {
    id: "paper",
    label: "Paper Terminal",
    background: [234, 229, 215],
    surface: [248, 245, 235],
    surfaceStrong: [218, 211, 194],
    border: [104, 98, 87],
    text: [35, 38, 42],
    muted: [101, 100, 96],
    accent: [33, 92, 145],
    success: [42, 116, 65],
    warning: [157, 101, 11],
    danger: [165, 48, 48],
  },
] as const satisfies readonly MuxstoneThemeSpec[];

/** Complete catalog: native themes, every Workbench theme, then T2. */
export const MUXSTONE_THEMES = [
  ...MUXSTONE_NATIVE_THEMES,
  ...grWizardThemePalettes.map(muxstoneWorkbenchTheme),
  {
    id: "t2",
    label: "T2 Neural Steel",
    background: MUXSTONE_T2_SWATCHES.black,
    surface: MUXSTONE_T2_SWATCHES.charcoal,
    surfaceStrong: MUXSTONE_T2_SWATCHES.darkBlue,
    border: MUXSTONE_T2_SWATCHES.darkPurple,
    text: MUXSTONE_T2_SWATCHES.lightBlue,
    muted: MUXSTONE_T2_SWATCHES.lightPurple,
    accent: MUXSTONE_T2_SWATCHES.lightBlue,
    success: MUXSTONE_T2_SWATCHES.lightBlue,
    warning: MUXSTONE_T2_SWATCHES.darkPurple,
    danger: MUXSTONE_T2_SWATCHES.lightPurple,
  },
] as const satisfies readonly MuxstoneThemeSpec[];

/** Adapts one Workbench semantic palette without duplicating its hex source. */
function muxstoneWorkbenchTheme(
  palette: (typeof grWizardThemePalettes)[number],
): MuxstoneThemeSpec {
  return {
    id: muxstoneWorkbenchThemeId(palette.name),
    label: palette.label,
    background: muxstoneHexRgb(palette.bg),
    surface: muxstoneHexRgb(palette.surface),
    surfaceStrong: muxstoneHexRgb(palette.panelAlt),
    border: muxstoneHexRgb(palette.borderStrong),
    text: muxstoneHexRgb(palette.text),
    muted: muxstoneHexRgb(palette.textMuted),
    accent: muxstoneHexRgb(palette.accent),
    success: muxstoneHexRgb(palette.success),
    warning: muxstoneHexRgb(palette.warning),
    danger: muxstoneHexRgb(palette.danger),
  };
}

/** Fails loudly if the shared Workbench catalog changes without an ID migration. */
function muxstoneWorkbenchThemeId(id: string): MuxstoneWorkbenchThemeId {
  const match = MUXSTONE_WORKBENCH_THEME_IDS.find((candidate) => candidate === id);
  if (!match) throw new TypeError(`Unsupported Workbench theme id: ${id}`);
  return match;
}

/** Converts the Workbench's canonical six-digit hex colors to renderer RGB. */
function muxstoneHexRgb(hex: string): MuxstoneRgb {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  if (!match) throw new TypeError(`Invalid Workbench theme color: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** Clone-safe session metadata returned by the detached host. */
export interface MuxstoneSessionSummary {
  readonly id: string;
  readonly title: string;
  readonly commandLine: string;
  readonly status: "running" | "exited" | "failed";
  readonly running: boolean;
  readonly columns: number;
  readonly rows: number;
  readonly sequence: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly exitCode?: number;
}

/** One ordered terminal payload retained by the host for reattachment. */
export interface MuxstoneOutputFrame {
  readonly sessionId: string;
  readonly sequence: number;
  readonly data: string | Uint8Array;
}

/** Result of attaching a client view to a host-owned terminal. */
export interface MuxstoneAttachResult {
  readonly session: MuxstoneSessionSummary;
  readonly replay: readonly MuxstoneOutputFrame[];
  readonly truncated: boolean;
}

/** Options accepted when a new real shell is launched. */
export interface MuxstoneSpawnOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly columns?: number;
  readonly rows?: number;
}

/** Narrow client port used by the renderer-neutral controller and fakes. */
export interface MuxstoneClientPort {
  readonly connected: boolean;
  list(): Promise<readonly MuxstoneSessionSummary[]>;
  spawn(options: MuxstoneSpawnOptions): Promise<MuxstoneSessionSummary>;
  attach(
    sessionId: string,
    options: {
      readonly sinceSequence?: number;
      readonly onOutput: (frame: MuxstoneOutputFrame) => void;
      readonly onSession?: (session: MuxstoneSessionSummary) => void;
    },
  ): Promise<MuxstoneAttachResult>;
  detach(sessionId: string): Promise<boolean>;
  input(sessionId: string, data: string | Uint8Array): Promise<boolean>;
  resize(sessionId: string, columns: number, rows: number): Promise<boolean>;
  kill(sessionId: string): Promise<boolean>;
  shutdownHost(): Promise<boolean>;
  dispose(): Promise<void>;
}

/** JSON-safe metadata stored alongside the exact window-host snapshot. */
/** Selectable animated desktop backgrounds in stable cycle order. */
export const MUXSTONE_BACKGROUND_IDS = ["metaballs", "matrix", "circuit", "biomech", "jungle", "vaporwave"] as const;
export type MuxstoneBackgroundId = (typeof MUXSTONE_BACKGROUND_IDS)[number];

/** Normalizes any persisted value to a known background id. */
export function muxstoneBackgroundId(value: unknown): MuxstoneBackgroundId {
  return MUXSTONE_BACKGROUND_IDS.includes(value as MuxstoneBackgroundId) ? value as MuxstoneBackgroundId : "metaballs";
}

export interface MuxstoneWorkspaceState {
  readonly schemaVersion: typeof MUXSTONE_SESSION_SCHEMA_VERSION;
  readonly themeId: MuxstoneThemeId;
  readonly activeSessionId?: string;
  readonly terminalOrdinal: number;
  readonly savedHosts: readonly string[];
  readonly backgroundId: MuxstoneBackgroundId;
  /** Session id → SSH target for shells opened from the network panel. */
  readonly sessionHosts: Readonly<Record<string, string>>;
}

/** Maximum remembered SSH targets persisted with the workspace. */
export const MUXSTONE_MAX_SAVED_HOSTS = 64;

/** Conservative SSH target check: optional user@ plus hostname/IP, no option-like leading dash. */
export function isMuxstoneSshTarget(value: string): boolean {
  return value.length <= 253 && /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,63}@)?[A-Za-z0-9][A-Za-z0-9.:_-]{0,252}$/.test(value);
}

/** Public, content-minimized controller lifecycle inspection. */
export interface MuxstoneControllerInspection {
  readonly disposed: boolean;
  readonly connected: boolean;
  readonly themeId: MuxstoneThemeId;
  readonly activeSessionId?: string;
  readonly prefixPending: boolean;
  readonly status: string;
  readonly sessionCount: number;
  readonly attachedCount: number;
  readonly runningCount: number;
  readonly persistenceStatus: string;
  readonly sessions: readonly MuxstoneSessionSummary[];
}

/** Showcase metadata used by the shared lifecycle/persistence kernel. */
export const MUXSTONE_MANIFEST = defineShowcaseManifest({
  id: "muxstone",
  title: "Muxstone",
  appVersion: "1.0.0",
  routes: [
    { id: "workspace", title: "Workspace" },
    { id: "sessions", title: "Sessions" },
    { id: "help", title: "Help" },
  ],
  initialRouteId: "workspace",
  requiredCapabilities: ["terminal.multiplex", "window.advanced"],
  optionalCapabilities: ["terminal.pty", "terminal.replay"],
  hosts: { terminal: true, browser: false },
});

/** Returns one validated theme, falling back to Midnight Ops. */
export function muxstoneTheme(id: unknown): MuxstoneThemeSpec {
  return MUXSTONE_THEMES.find((theme) => theme.id === id) ?? MUXSTONE_THEMES[0]!;
}

/** Stable outer-window identity for one daemon session. */
export function muxstoneWindowId(sessionId: string): string {
  return `terminal-${sessionId}`;
}

/** Recovers the daemon session identity from a terminal window id. */
export function muxstoneSessionIdFromWindow(windowId: string | undefined): string | undefined {
  return windowId?.startsWith("terminal-") ? windowId.slice("terminal-".length) || undefined : undefined;
}

/** Strictly normalizes JSON-safe app metadata without trusting prototypes. */
export function normalizeMuxstoneWorkspaceState(value: unknown): MuxstoneWorkspaceState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return initialMuxstoneWorkspaceState();
  const record = value as Record<string, unknown>;
  const themeId = muxstoneTheme(record.themeId).id;
  const terminalOrdinal = Number.isSafeInteger(record.terminalOrdinal) && (record.terminalOrdinal as number) >= 1
    ? Math.min(1_000_000, record.terminalOrdinal as number)
    : 1;
  const activeSessionId = typeof record.activeSessionId === "string" && isMuxstoneSessionId(record.activeSessionId)
    ? record.activeSessionId
    : undefined;
  const savedHosts: string[] = [];
  if (Array.isArray(record.savedHosts)) {
    for (const host of record.savedHosts) {
      if (savedHosts.length >= MUXSTONE_MAX_SAVED_HOSTS) break;
      if (typeof host === "string" && isMuxstoneSshTarget(host) && !savedHosts.includes(host)) {
        savedHosts.push(host);
      }
    }
  }
  const sessionHosts: Record<string, string> = {};
  if (record.sessionHosts && typeof record.sessionHosts === "object" && !Array.isArray(record.sessionHosts)) {
    for (const [sessionId, target] of Object.entries(record.sessionHosts as Record<string, unknown>)) {
      if (Object.keys(sessionHosts).length >= MUXSTONE_MAX_SAVED_HOSTS) break;
      if (isMuxstoneSessionId(sessionId) && typeof target === "string" && isMuxstoneSshTarget(target)) {
        sessionHosts[sessionId] = target;
      }
    }
  }
  return Object.freeze({
    schemaVersion: MUXSTONE_SESSION_SCHEMA_VERSION,
    themeId,
    terminalOrdinal,
    ...(activeSessionId ? { activeSessionId } : {}),
    savedHosts: Object.freeze(savedHosts),
    backgroundId: muxstoneBackgroundId(record.backgroundId),
    sessionHosts: Object.freeze(sessionHosts),
  });
}

/** Default durable metadata. */
export function initialMuxstoneWorkspaceState(): MuxstoneWorkspaceState {
  return Object.freeze({
    schemaVersion: MUXSTONE_SESSION_SCHEMA_VERSION,
    themeId: "midnight",
    terminalOrdinal: 1,
    savedHosts: Object.freeze([]) as readonly string[],
    backgroundId: "metaballs" as const,
    sessionHosts: Object.freeze({}),
  });
}

/** Content-safe session-id check shared by state restoration and controller calls. */
export function isMuxstoneSessionId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}
