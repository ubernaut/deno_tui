import type { KeyPressEvent } from "../src/input_reader/types.ts";
import { decodeBuffer } from "../src/input_reader/mod.ts";
import { HIDE_CURSOR, moveCursor, SHOW_CURSOR } from "../src/utils/ansi_codes.ts";
import {
  type AppliedCalibration,
  applyCalibrationProfile,
  CALIBRATION_PROFILES,
  createLaunchPlan,
  detectHardware,
  discoverModelCandidates,
  type GeoRefineContext,
  GOAL_PRESETS,
  type GoalPreset,
  type LaunchPlan,
  loadLocalEnv,
  loadModelCatalog,
  loadRunSnapshot,
  type ModelCandidate,
  prepareLaunchArtifacts,
  resolveGeoRefineRoot,
  type RunBoard,
  type RunSnapshot,
  spawnDockerRun,
} from "./grwizard_backend.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { accentColor, formatBytes, formatDuration, formatPercent, formatRate, makeStyle, palette } from "./styles.ts";
import type { Accent, SlotConfig, SourceFrame, SystemSnapshot } from "./types.ts";
import { renderVisualization } from "./visualizations.ts";

type TabId = "launch" | "overview" | "board" | "output" | "model" | "goal";
type StageId = "scan" | "model" | "goal" | "profile" | "review" | "running" | "postrun";
type RunMode = "run" | "dry-run";
type RunLifecycle =
  | "idle"
  | "preparing"
  | "building"
  | "starting"
  | "running"
  | "cancelling"
  | "complete"
  | "failed"
  | "cancelled";
type ConfirmKind = "cancel" | "quit" | null;
type ViewportClass = "tiny" | "small" | "medium" | "large";

type StyleFn = (text: string) => string;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CliOptions {
  rootOverride?: string;
  defaultDryRun: boolean;
  openBoardFirst: boolean;
  listOnly: boolean;
  noSplash: boolean;
  help: boolean;
}

interface BootStep {
  id: string;
  label: string;
  done: boolean;
}

interface TelemetryHistory {
  progress: number[];
  modelLoad: number[];
  dataLoad: number[];
  alerts: number[];
}

interface RunStateData {
  mode: RunMode | null;
  lifecycle: RunLifecycle;
  startedAt: number | null;
  exitCode: number | null;
  child: Deno.ChildProcess | null;
  plan: LaunchPlan | null;
  snapshot: RunSnapshot | null;
  cancelRequested: boolean;
  quitAfterCancel: boolean;
}

interface AppState {
  activeTab: TabId;
  stage: StageId;
  showSplash: boolean;
  splashFrame: number;
  splashDismissed: boolean;
  bootSteps: BootStep[];
  bootNote: string;
  bootError: string;
  context: GeoRefineContext | null;
  selectedModelIndex: number;
  selectedGoalIndex: number;
  selectedCalibrationIndex: number;
  statusLine: string;
  outputLines: string[];
  recentEvents: string[];
  outputScroll: number;
  numberBuffer: string;
  numberBufferAt: number;
  confirmKind: ConfirmKind;
  telemetry: TelemetryHistory;
  run: RunStateData;
  shouldExit: boolean;
}

const encoder = new TextEncoder();
const HISTORY_LIMIT = 60;
const MAX_OUTPUT_LINES = 4000;
const MAX_EVENT_LINES = 120;
const BOOT_MIN_MS = 1300;
const INPUT_BUFFER_TIMEOUT_MS = 1200;
const RENDER_INTERVAL_MS = 1000 / 8;
const POLL_INTERVAL_MS = 1000;

const tabs: Array<{ id: TabId; label: string; short: string; accent: Accent }> = [
  { id: "launch", label: "Launch", short: "LAUNCH", accent: "amber" },
  { id: "overview", label: "Overview", short: "OVERVIEW", accent: "signal" },
  { id: "board", label: "Board", short: "BOARD", accent: "phosphor" },
  { id: "output", label: "Output", short: "OUTPUT", accent: "signal" },
  { id: "model", label: "Model", short: "MODEL", accent: "violet" },
  { id: "goal", label: "Goal", short: "GOAL", accent: "amber" },
];

const splashTitle = [
  String.raw`               __      ___                  __`,
  String.raw`   ____ ______/ /_ _  / _ |___  ________ _/ /`,
  String.raw`  / _ \`/ __/ __/  ' \\/ __ / _ \\/ __/ _ \`/ _ \\`,
  String.raw`  \\_, /_/  \\__/_/_/_/_/ |_\\___/_/  \\_,_/_.__/`,
  String.raw` /___/                                        `,
  String.raw` __      ___             __             __`,
  String.raw`/ /_    / _ |___  _____ / /____ ____ __/ /`,
  String.raw`/ __/  / __ / _ \\/ -_) / __/ -_) __/ _  / `,
  String.raw`\\__/  /_/ |_|_//_/\\__/  \\__/\\__/_/  \\_,_/  `,
];

const wizardFrames = [
  [
    "            *",
    "           /|\\",
    "          /_|_\\",
    "       .-' /_\\ '-.",
    "      /___/___\\___\\",
    "         / .-. \\",
    "         | | | | |",
    "         | |_| | |",
    "      .-./`---'\\.-.",
    "     /___/     \\___\\",
  ],
  [
    "            *",
    "           /|\\",
    "          /_|_\\",
    "       .-' /_\\ '-.",
    "      /___/___\\___\\",
    "         / o-o \\",
    "         | | | | |",
    "         | |_| | |",
    "      .-./`---'\\.-.",
    "     /___/     \\___\\",
  ],
];

const styles = {
  signal: makeStyle({ fg: accentColor("signal"), bold: true }),
  amber: makeStyle({ fg: accentColor("amber"), bold: true }),
  phosphor: makeStyle({ fg: accentColor("phosphor"), bold: true }),
  violet: makeStyle({ fg: accentColor("violet"), bold: true }),
  alarm: makeStyle({ fg: accentColor("alarm"), bold: true }),
  dim: makeStyle({ fg: palette.dim }),
  heading: makeStyle({ fg: palette.paper, bold: true }),
  selected: makeStyle({ fg: palette.void, bg: accentColor("signal"), bold: true }),
  selectedAmber: makeStyle({ fg: palette.void, bg: accentColor("amber"), bold: true }),
  selectedPhosphor: makeStyle({ fg: palette.void, bg: accentColor("phosphor"), bold: true }),
  selectedViolet: makeStyle({ fg: palette.void, bg: accentColor("violet"), bold: true }),
  error: makeStyle({ fg: accentColor("alarm"), bold: true }),
  success: makeStyle({ fg: accentColor("phosphor"), bold: true }),
};

const hiddenRect = (): Rect => ({ x: 0, y: 0, width: 0, height: 0 });

export function detectViewportClass(width: number, height: number): ViewportClass {
  if (width >= 145 && height >= 38) {
    return "large";
  }
  if (width >= 118 && height >= 30) {
    return "medium";
  }
  if (width >= 88 && height >= 22) {
    return "small";
  }
  return "tiny";
}

function fitRank(fit: ModelCandidate["fit"]) {
  switch (fit) {
    case "good":
      return 0;
    case "stretch":
      return 1;
    case "cpu-only":
      return 2;
    default:
      return 3;
  }
}

export function sortCandidatesForDisplay(candidates: ModelCandidate[]) {
  return [...candidates].sort((left, right) => {
    const sectionRank = left.section === right.section ? 0 : left.section === "local" ? -1 : 1;
    if (sectionRank !== 0) {
      return sectionRank;
    }
    const fitDelta = fitRank(left.fit) - fitRank(right.fit);
    if (fitDelta !== 0) {
      return fitDelta;
    }
    const localRank = Number(right.localOnly) - Number(left.localOnly);
    if (localRank !== 0) {
      return localRank;
    }
    const paramsLeft = left.paramsB ?? Number.POSITIVE_INFINITY;
    const paramsRight = right.paramsB ?? Number.POSITIVE_INFINITY;
    if (paramsLeft !== paramsRight) {
      return paramsLeft - paramsRight;
    }
    return left.display.localeCompare(right.display);
  });
}

export function recommendModelIndex(candidates: ModelCandidate[]) {
  const localGood = candidates.findIndex((candidate) => candidate.section === "local" && candidate.fit === "good");
  if (localGood >= 0) {
    return localGood;
  }
  const anyGood = candidates.findIndex((candidate) => candidate.fit === "good");
  if (anyGood >= 0) {
    return anyGood;
  }
  const stretch = candidates.findIndex((candidate) => candidate.fit === "stretch");
  return stretch >= 0 ? stretch : 0;
}

export function windowRange(length: number, selectedIndex: number, capacity: number) {
  if (capacity <= 0 || length <= capacity) {
    return { start: 0, end: length };
  }
  const half = Math.floor(capacity / 2);
  let start = Math.max(0, selectedIndex - half);
  let end = start + capacity;
  if (end > length) {
    end = length;
    start = Math.max(0, end - capacity);
  }
  return { start, end };
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    defaultDryRun: false,
    openBoardFirst: false,
    listOnly: false,
    noSplash: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      options.defaultDryRun = true;
    } else if (arg === "--show-board") {
      options.openBoardFirst = true;
    } else if (arg === "--list-only") {
      options.listOnly = true;
    } else if (arg === "--no-splash") {
      options.noSplash = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--root") {
      options.rootOverride = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.rootOverride = arg.slice("--root=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    "grWizard - GeoRefine Wizard",
    "",
    "Usage:",
    "  deno task grwizard",
    "  deno task grwizard -- --dry-run",
    "  deno task grwizard -- --show-board",
    "  deno task grwizard -- --list-only",
    "  deno task grwizard -- --no-splash",
    "  deno task grwizard -- --root /path/to/GeoRefineInternal",
  ].join("\n");
}

function createBootSteps(): BootStep[] {
  return [
    { id: "root", label: "Resolve GeoRefine workspace", done: false },
    { id: "env", label: "Load local Hugging Face auth", done: false },
    { id: "hardware", label: "Inspect host hardware", done: false },
    { id: "catalog", label: "Load curated model catalog", done: false },
    { id: "models", label: "Rank local cache and Hugging Face models", done: false },
  ];
}

function initialState(options: CliOptions): AppState {
  return {
    activeTab: options.openBoardFirst ? "board" : "launch",
    stage: "scan",
    showSplash: !options.noSplash,
    splashFrame: 0,
    splashDismissed: options.noSplash,
    bootSteps: createBootSteps(),
    bootNote: "Resolving GeoRefine workspace...",
    bootError: "",
    context: null,
    selectedModelIndex: 0,
    selectedGoalIndex: GOAL_PRESETS.findIndex((goal: GoalPreset) => goal.name === "balanced"),
    selectedCalibrationIndex: 0,
    statusLine: "Booting GeoRefine context...",
    outputLines: ["[boot] grWizard console online", "[boot] waiting for GeoRefine scan"],
    recentEvents: ["Booting grWizard"],
    outputScroll: 0,
    numberBuffer: "",
    numberBufferAt: 0,
    confirmKind: null,
    telemetry: {
      progress: [],
      modelLoad: [],
      dataLoad: [],
      alerts: [],
    },
    run: {
      mode: null,
      lifecycle: "idle",
      startedAt: null,
      exitCode: null,
      child: null,
      plan: null,
      snapshot: null,
      cancelRequested: false,
      quitAfterCancel: false,
    },
    shouldExit: false,
  };
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function pushTail<T>(items: T[], value: T, limit: number) {
  items.push(value);
  while (items.length > limit) {
    items.shift();
  }
}

function pushMetric(history: number[], value: number) {
  history.push(clamp(value));
  while (history.length > HISTORY_LIMIT) {
    history.shift();
  }
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function crop(text: string, width: number) {
  if (width <= 0) {
    return "";
  }
  const chars = Array.from(text);
  if (chars.length <= width) {
    return text;
  }
  if (width <= 1) {
    return chars[0] ?? "";
  }
  return chars.slice(0, width - 1).join("") + "…";
}

function pad(text: string, width: number) {
  const chars = Array.from(text);
  if (chars.length >= width) {
    return chars.slice(0, width).join("");
  }
  return text + " ".repeat(width - chars.length);
}

function wrap(text: string, width: number) {
  if (width <= 1) {
    return [crop(text, Math.max(1, width))];
  }
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }
      if ((current + " " + word).length <= width) {
        current += ` ${word}`;
      } else {
        lines.push(crop(current, width));
        if (word.length > width) {
          let remaining = word;
          while (remaining.length > width) {
            lines.push(remaining.slice(0, width - 1) + "-");
            remaining = remaining.slice(width - 1);
          }
          current = remaining;
        } else {
          current = word;
        }
      }
    }
    if (current) {
      lines.push(crop(current, width));
    }
  }
  return lines;
}

function progressBar(ratio: number, width: number) {
  const safeWidth = Math.max(4, width);
  const filled = Math.round(clamp(ratio) * safeWidth);
  return "█".repeat(filled) + "░".repeat(Math.max(0, safeWidth - filled));
}

function humanBool(value: boolean) {
  return value ? "yes" : "no";
}

function formatParams(candidate: ModelCandidate) {
  return candidate.paramsB == null ? "-" : `${candidate.paramsB.toFixed(candidate.paramsB >= 10 ? 0 : 1)}B`;
}

function formatFit(candidate: ModelCandidate) {
  return candidate.fit.toUpperCase().padEnd(8, " ");
}

function stageLabel(stage: StageId) {
  switch (stage) {
    case "scan":
      return "Scan";
    case "model":
      return "Model";
    case "goal":
      return "Goal";
    case "profile":
      return "Profile";
    case "review":
      return "Review";
    case "running":
      return "Running";
    case "postrun":
      return "Post-Run";
  }
}

function runLabel(lifecycle: RunLifecycle) {
  switch (lifecycle) {
    case "idle":
      return "Idle";
    case "preparing":
      return "Preparing";
    case "building":
      return "Building Image";
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "cancelling":
      return "Cancelling";
    case "complete":
      return "Complete";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
  }
}

class ScreenBuffer {
  readonly width: number;
  readonly height: number;
  readonly rows: string[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
  }

  put(x: number, y: number, char: string, style?: StyleFn) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || !char) {
      return;
    }
    this.rows[y]![x] = style ? style(char) : char;
  }

  write(x: number, y: number, text: string, style?: StyleFn) {
    let column = x;
    for (const char of Array.from(text)) {
      if (column >= this.width) {
        break;
      }
      this.put(column, y, char, style);
      column += 1;
    }
  }

  fill(rect: Rect, char = " ", style?: StyleFn) {
    for (let row = rect.y; row < rect.y + rect.height; row += 1) {
      for (let column = rect.x; column < rect.x + rect.width; column += 1) {
        this.put(column, row, char, style);
      }
    }
  }

  box(rect: Rect, title: string, accent: Accent) {
    if (rect.width < 2 || rect.height < 2) {
      return;
    }
    const borderStyle = styleForAccent(accent);
    const innerWidth = rect.width - 2;
    const titleText = crop(` ${title} `, Math.max(0, innerWidth));
    this.put(rect.x, rect.y, "┌", borderStyle);
    for (let index = 0; index < innerWidth; index += 1) {
      const char = titleText[index] ?? "─";
      this.put(rect.x + 1 + index, rect.y, char, borderStyle);
    }
    this.put(rect.x + rect.width - 1, rect.y, "┐", borderStyle);
    for (let row = rect.y + 1; row < rect.y + rect.height - 1; row += 1) {
      this.put(rect.x, row, "│", borderStyle);
      this.put(rect.x + rect.width - 1, row, "│", borderStyle);
    }
    this.put(rect.x, rect.y + rect.height - 1, "└", borderStyle);
    for (let index = 0; index < innerWidth; index += 1) {
      this.put(rect.x + 1 + index, rect.y + rect.height - 1, "─", borderStyle);
    }
    this.put(rect.x + rect.width - 1, rect.y + rect.height - 1, "┘", borderStyle);
  }

  textBlock(rect: Rect, lines: string[], style?: StyleFn) {
    const contentHeight = Math.max(0, rect.height);
    for (let row = 0; row < Math.min(lines.length, contentHeight); row += 1) {
      this.write(rect.x, rect.y + row, pad(crop(lines[row] ?? "", rect.width), rect.width), style);
    }
  }

  render() {
    return this.rows.map((row) => row.join("")).join("\n");
  }
}

function styleForAccent(accent: Accent): StyleFn {
  switch (accent) {
    case "amber":
      return styles.amber;
    case "phosphor":
      return styles.phosphor;
    case "violet":
      return styles.violet;
    case "alarm":
      return styles.alarm;
    default:
      return styles.signal;
  }
}

function selectionStyle(accent: Accent): StyleFn {
  switch (accent) {
    case "amber":
      return styles.selectedAmber;
    case "phosphor":
      return styles.selectedPhosphor;
    case "violet":
      return styles.selectedViolet;
    default:
      return styles.selected;
  }
}

function inset(rect: Rect, dx: number, dy = dx): Rect {
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: Math.max(0, rect.width - dx * 2),
    height: Math.max(0, rect.height - dy * 2),
  };
}

function splitColumns(rect: Rect, leftWidth: number, gap = 1): [Rect, Rect] {
  const safeLeft = Math.max(0, Math.min(leftWidth, rect.width));
  const rightX = rect.x + safeLeft + gap;
  return [
    { x: rect.x, y: rect.y, width: Math.max(0, safeLeft), height: rect.height },
    {
      x: rightX,
      y: rect.y,
      width: Math.max(0, rect.width - safeLeft - gap),
      height: rect.height,
    },
  ];
}

function splitRows(rect: Rect, topHeight: number, gap = 1): [Rect, Rect] {
  const safeTop = Math.max(0, Math.min(topHeight, rect.height));
  const bottomY = rect.y + safeTop + gap;
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: Math.max(0, safeTop) },
    {
      x: rect.x,
      y: bottomY,
      width: rect.width,
      height: Math.max(0, rect.height - safeTop - gap),
    },
  ];
}

function stackRows(rect: Rect, count: number, gap = 1) {
  if (count <= 0) {
    return [] as Rect[];
  }
  const totalGap = gap * (count - 1);
  const usableHeight = Math.max(0, rect.height - totalGap);
  const base = Math.floor(usableHeight / count);
  let remainder = usableHeight % count;
  let cursor = rect.y;
  const rows: Rect[] = [];
  for (let index = 0; index < count; index += 1) {
    const height = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    rows.push({ x: rect.x, y: cursor, width: rect.width, height });
    cursor += height + gap;
  }
  return rows;
}

function stackColumns(rect: Rect, count: number, gap = 1) {
  if (count <= 0) {
    return [] as Rect[];
  }
  const totalGap = gap * (count - 1);
  const usableWidth = Math.max(0, rect.width - totalGap);
  const base = Math.floor(usableWidth / count);
  let remainder = usableWidth % count;
  let cursor = rect.x;
  const cols: Rect[] = [];
  for (let index = 0; index < count; index += 1) {
    const width = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    cols.push({ x: cursor, y: rect.y, width, height: rect.height });
    cursor += width + gap;
  }
  return cols;
}

function fitLabel(fit: ModelCandidate["fit"]) {
  switch (fit) {
    case "good":
      return "GOOD";
    case "stretch":
      return "STRETCH";
    case "cpu-only":
      return "CPU";
    default:
      return "UNLIKELY";
  }
}

function summarizeBoard(board: RunBoard) {
  return [
    `backlog ${board.backlog.length}`,
    `active ${board.active.length}`,
    `review ${board.review.length}`,
    `done ${board.done.length}`,
  ].join("  •  ");
}

function footerForStage(state: AppState) {
  if (state.confirmKind) {
    return "[y] confirm  [n/esc] stay  [tab] tabs  [q] quit";
  }
  if (state.showSplash) {
    return "[enter/space] continue  [q] quit";
  }
  if (state.stage === "scan") {
    return "[r] rescan  [1-6/tab] tabs  [q] quit";
  }
  if (state.stage === "model") {
    return "[up/down j/k] select model  [0-9] jump  [enter] next  [pgup/pgdn] jump  [b] back  [r] rescan  [tab] tabs  [q] quit";
  }
  if (state.stage === "goal") {
    return "[up/down j/k] select goal  [0-9] jump  [enter] next  [b] back  [tab] tabs  [q] quit";
  }
  if (state.stage === "profile") {
    return "[up/down j/k] select calibration  [0-9] jump  [enter] next  [b] back  [tab] tabs  [q] quit";
  }
  if (state.stage === "review") {
    return "[enter/s] start run  [d] dry run  [b] back  [tab] tabs  [q] quit";
  }
  if (state.stage === "running") {
    return "[1-6/tab] tabs  [c] cancel run  [q] cancel + quit  [up/down] scroll output on Output tab";
  }
  return "[n] new run  [r] rescan  [1-6/tab] tabs  [q] quit";
}

function bootProgress(steps: BootStep[]) {
  if (steps.length === 0) {
    return 0;
  }
  return steps.filter((step) => step.done).length / steps.length;
}

function currentSelection(state: AppState) {
  const context = state.context;
  if (!context) {
    return null;
  }
  const model = context.candidates[state.selectedModelIndex];
  const goal = context.goals[state.selectedGoalIndex];
  const calibrationProfile = context.calibrations[state.selectedCalibrationIndex] ?? CALIBRATION_PROFILES[0]!;
  if (!model || !goal || !calibrationProfile) {
    return null;
  }
  const applied = applyCalibrationProfile(goal, calibrationProfile.id);
  return {
    model,
    goal,
    calibrationProfile,
    applied,
  } satisfies {
    model: ModelCandidate;
    goal: GoalPreset;
    calibrationProfile: GeoRefineContext["calibrations"][number];
    applied: AppliedCalibration;
  };
}

function safeSystemSnapshot(systemMonitor: SystemMonitor): SystemSnapshot {
  return systemMonitor.snapshot.value;
}

function buildSources(state: AppState, system: SystemSnapshot): SourceFrame[] {
  const snapshot = state.run.snapshot;
  const progressValue = snapshot?.progressRatio ?? bootProgress(state.bootSteps);
  const modelLoadValue = snapshot?.modelLoadRatio ?? 0;
  const dataLoadValue = snapshot?.dataLoadRatio ?? 0;
  const alertValue = clamp((snapshot?.alerts.length ?? 0) / 6);

  return [
    {
      id: "progress",
      name: "Progress",
      accent: "signal",
      value: progressValue,
      series: state.telemetry.progress,
      detailLines: [
        `Stage ${stageLabel(state.stage)}`,
        `Run ${runLabel(state.run.lifecycle)}`,
      ],
    },
    {
      id: "model-load",
      name: "Model Load",
      accent: "amber",
      value: modelLoadValue,
      series: state.telemetry.modelLoad,
      detailLines: [snapshot?.currentPhase ?? "idle"],
    },
    {
      id: "data-load",
      name: "Data Load",
      accent: "phosphor",
      value: dataLoadValue,
      series: state.telemetry.dataLoad,
      detailLines: [snapshot?.progressLabel ?? state.statusLine],
    },
    {
      id: "cpu",
      name: "CPU",
      accent: "signal",
      value: clamp(system.cpuOverall / 100),
      series: system.cpuHistory,
      detailLines: [`${formatPercent(system.cpuOverall)}`],
    },
    {
      id: "memory",
      name: "Memory",
      accent: "violet",
      value: clamp(system.memory.percent / 100),
      series: system.memoryHistory,
      detailLines: [formatBytes(system.memory.used), formatBytes(system.memory.total)],
    },
    {
      id: "alerts",
      name: "Alerts",
      accent: alertValue > 0 ? "alarm" : "phosphor",
      value: alertValue,
      series: state.telemetry.alerts,
      detailLines: snapshot?.alerts.slice(0, 2) ?? ["stable"],
    },
  ];
}

function renderVisualizationBody(
  visualizationId: string,
  width: number,
  height: number,
  state: AppState,
  system: SystemSnapshot,
) {
  const slot: SlotConfig = {
    id: "cpu",
    name: visualizationId,
    visualizationId,
    inputSourceIds: [],
    cycleEnabled: false,
    cycleIntervalMs: 0,
    ascii: {
      preset: "sharp",
      border: "sharp",
      terminalGlyphStyle: "blocks",
      terminalEdgeBias: 0,
      edgeThreshold: 0.46,
      normalThreshold: 0.5,
      depthThreshold: 0.5,
      exposure: 1,
      attenuation: 1,
      blendWithBase: 0,
      depthFalloff: 1,
      depthOffset: 0,
      wireframeThickness: 8,
      renderMaxCells: 3_840,
      deferredReadbackSlots: 6,
      edges: false,
      fill: true,
      invertLuminance: false,
      kittyGraphics: false,
      kittyDisableAscii: true,
    },
  };
  const panel = renderVisualization({
    slot,
    system,
    sources: buildSources(state, system),
    phase: Date.now() / 900,
    width: Math.max(16, width),
    height: Math.max(8, height),
  });
  const lines = panel.body.split("\n");
  if (panel.footer) {
    lines.push("");
    lines.push(panel.footer);
  }
  return {
    lines,
    accent: panel.accent,
  };
}

function titleStyle(tab: TabId) {
  const meta = tabs.find((entry) => entry.id === tab);
  return styleForAccent(meta?.accent ?? "signal");
}

class ImmediateWizardApp {
  readonly options: CliOptions;
  readonly state: AppState;
  readonly systemMonitor = new SystemMonitor(HISTORY_LIMIT);
  readonly startedAt = Date.now();
  readonly splashMinUntil = Date.now() + BOOT_MIN_MS;
  #renderTimer: number | null = null;
  #pollTimer: number | null = null;
  #bootPromise: Promise<void> | null = null;
  #lastFrame = "";

  constructor(options: CliOptions) {
    this.options = options;
    this.state = initialState(options);
  }

  async run() {
    Deno.stdout.writeSync(encoder.encode("\x1b[2J" + HIDE_CURSOR));
    try {
      try {
        Deno.stdin.setRaw(true, { cbreak: Deno.build.os !== "windows" });
      } catch {
        // ignore raw-mode failures in unsupported hosts
      }
      await this.systemMonitor.start(1000);
      this.#bootPromise = this.scanContext();
      this.#renderTimer = setInterval(() => {
        this.state.splashFrame += 1;
        this.clearExpiredNumberBuffer();
        if (
          this.state.showSplash &&
          (this.state.context || this.state.bootError) &&
          Date.now() >= this.splashMinUntil
        ) {
          this.state.showSplash = false;
          this.state.splashDismissed = true;
        }
        this.render();
      }, RENDER_INTERVAL_MS);
      this.#pollTimer = setInterval(() => {
        this.sampleTelemetry();
        void this.refreshRuntime();
      }, POLL_INTERVAL_MS);
      this.render();
      await this.readInputLoop();
      await this.#bootPromise.catch(() => undefined);
    } finally {
      if (this.#renderTimer != null) {
        clearInterval(this.#renderTimer);
      }
      if (this.#pollTimer != null) {
        clearInterval(this.#pollTimer);
      }
      this.systemMonitor.stop();
      try {
        Deno.stdin.setRaw(false);
      } catch {
        // ignore
      }
      Deno.stdout.writeSync(encoder.encode(`${SHOW_CURSOR}\x1b[0m${moveCursor(Math.max(0, this.height() - 1), 0)}\n`));
    }
  }

  width() {
    try {
      return Deno.consoleSize().columns;
    } catch {
      return 120;
    }
  }

  height() {
    try {
      return Deno.consoleSize().rows;
    } catch {
      return 36;
    }
  }

  appendOutput(line: string) {
    pushTail(this.state.outputLines, line, MAX_OUTPUT_LINES);
  }

  appendEvent(message: string) {
    pushTail(this.state.recentEvents, `[${nowTime()}] ${message}`, MAX_EVENT_LINES);
  }

  clearExpiredNumberBuffer() {
    if (this.state.numberBuffer && Date.now() - this.state.numberBufferAt > INPUT_BUFFER_TIMEOUT_MS) {
      this.state.numberBuffer = "";
    }
  }

  markBootStep(id: string) {
    const step = this.state.bootSteps.find((entry) => entry.id === id);
    if (step) {
      step.done = true;
    }
  }

  async scanContext() {
    this.state.bootError = "";
    this.state.bootNote = "Resolving GeoRefine workspace...";
    this.state.stage = "scan";
    this.state.statusLine = "Scanning GeoRefine workspace";
    this.appendOutput("[boot] scanning GeoRefine workspace");

    try {
      const rootDir = await resolveGeoRefineRoot(this.options.rootOverride);
      this.markBootStep("root");
      this.state.bootNote = `Workspace found at ${rootDir}`;
      this.appendOutput(`[boot] root=${rootDir}`);

      const localEnvPath = `${rootDir}/grWizard/.env.local`;
      this.state.bootNote = "Loading local environment...";
      const localEnv = await loadLocalEnv(localEnvPath);
      this.markBootStep("env");
      this.appendOutput(`[boot] env=${Object.keys(localEnv).length > 0 ? "loaded" : "none"}`);

      this.state.bootNote = "Inspecting host hardware...";
      const hardware = await detectHardware(localEnv, rootDir);
      this.markBootStep("hardware");
      this.appendOutput(
        `[boot] hardware cpu=${hardware.cpuCores} ram=${hardware.systemRamGb}G gpu=${hardware.gpuName}`,
      );

      this.state.bootNote = "Loading model catalog...";
      const catalogPath = `${rootDir}/grWizard/model_catalog.json`;
      const catalog = await loadModelCatalog(catalogPath);
      this.markBootStep("catalog");
      this.appendOutput(`[boot] catalog=${catalog.length} entries`);

      this.state.bootNote = "Ranking local cache and Hugging Face models...";
      const candidates = sortCandidatesForDisplay(await discoverModelCandidates(rootDir, catalog, hardware));
      this.markBootStep("models");
      this.appendOutput(`[boot] candidates=${candidates.length}`);

      const context: GeoRefineContext = {
        rootDir,
        wizardDir: `${rootDir}/grWizard`,
        runsDir: `${rootDir}/grWizard/runs`,
        catalogPath,
        localEnvPath,
        hardware,
        localEnv,
        catalog,
        candidates,
        goals: [...GOAL_PRESETS],
        calibrations: [...CALIBRATION_PROFILES],
      };

      this.state.context = context;
      this.state.selectedModelIndex = recommendModelIndex(candidates);
      this.state.selectedGoalIndex = Math.max(
        0,
        GOAL_PRESETS.findIndex((goal: GoalPreset) => goal.name === "balanced"),
      );
      this.state.selectedCalibrationIndex = 0;
      this.state.stage = "model";
      this.state.statusLine = `${candidates.length} model candidates loaded`;
      this.state.bootNote = this.state.statusLine;
      this.appendEvent(`Scan complete: ${candidates.length} models ranked against local hardware`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.bootError = message;
      this.state.statusLine = `Boot failed: ${message}`;
      this.state.bootNote = message;
      this.appendOutput(`[boot] error=${message}`);
      this.appendEvent(`Boot failed: ${message}`);
    }
  }

  sampleTelemetry() {
    const snapshot = this.state.run.snapshot;
    pushMetric(this.state.telemetry.progress, snapshot?.progressRatio ?? bootProgress(this.state.bootSteps));
    pushMetric(this.state.telemetry.modelLoad, snapshot?.modelLoadRatio ?? 0);
    pushMetric(this.state.telemetry.dataLoad, snapshot?.dataLoadRatio ?? 0);
    pushMetric(this.state.telemetry.alerts, clamp((snapshot?.alerts.length ?? 0) / 6));
  }

  async refreshRuntime() {
    if (!this.state.run.plan) {
      return;
    }
    if (this.state.run.lifecycle === "idle") {
      return;
    }
    try {
      this.state.run.snapshot = await loadRunSnapshot(this.state.run.plan, this.state.outputLines);
      const progress = this.state.run.snapshot.progress;
      if (progress) {
        this.state.statusLine = `${progress.status} • ${progress.currentPhase} • ${
          progress.overallProgressPct.toFixed(0)
        }%`;
      } else if (this.state.run.snapshot.result) {
        this.state.statusLine =
          `${this.state.run.snapshot.result.runStatus} • ${this.state.run.snapshot.result.artifactKind}`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendOutput(`[poll] ${message}`);
    }
  }

  async ensureCompressImageInteractive(rootDir: string) {
    const inspect = await new Deno.Command("docker", {
      cwd: rootDir,
      args: ["image", "inspect", "georefine:compress"],
      stdout: "null",
      stderr: "null",
    }).output().catch(() => ({ success: false }));

    if (inspect.success) {
      this.appendOutput("[grWizard] docker image georefine:compress already available");
      return;
    }

    this.appendOutput("[grWizard] building docker image georefine:compress");
    const child = new Deno.Command("docker", {
      cwd: rootDir,
      args: ["compose", "build", "compress"],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    let finished = false;
    const watchCancel = (async () => {
      while (!finished) {
        await sleep(200);
        if (this.state.run.cancelRequested) {
          try {
            child.kill("SIGTERM");
          } catch {
            // ignore
          }
          return;
        }
      }
    })();

    await Promise.allSettled([
      this.consumeLines(child.stdout, (line) => this.appendOutput(line)),
      this.consumeLines(child.stderr, (line) => this.appendOutput(line)),
    ]);

    const status = await child.status;
    finished = true;
    await watchCancel;
    if (this.state.run.cancelRequested) {
      throw new Error("Image build cancelled");
    }
    if (!status.success) {
      throw new Error(`docker compose build compress failed with exit code ${status.code}`);
    }
  }

  async startRun(mode: RunMode) {
    if (!this.state.context) {
      this.appendEvent("Context is not ready yet");
      return;
    }
    if (
      this.state.run.lifecycle === "running" || this.state.run.lifecycle === "building" ||
      this.state.run.lifecycle === "starting"
    ) {
      this.appendEvent("A run is already active; cancel it before starting another");
      this.state.activeTab = "overview";
      return;
    }

    const selection = currentSelection(this.state);
    if (!selection) {
      this.appendEvent("Selection is incomplete");
      return;
    }

    const plan = createLaunchPlan(
      this.state.context,
      selection.model,
      selection.goal,
      selection.calibrationProfile.id,
      new Date(),
    );

    this.state.run = {
      mode,
      lifecycle: "preparing",
      startedAt: Date.now(),
      exitCode: null,
      child: null,
      plan,
      snapshot: null,
      cancelRequested: false,
      quitAfterCancel: false,
    };
    this.state.stage = mode === "dry-run" ? "review" : "running";
    this.state.activeTab = "overview";
    this.state.statusLine = `${mode === "dry-run" ? "Preparing dry run" : "Preparing run"} ${plan.runTag}`;
    this.appendOutput(`[grWizard] run_tag=${plan.runTag}`);
    this.appendOutput(`[grWizard] agenda=${plan.agendaPathHost}`);
    this.appendEvent(`${mode === "dry-run" ? "Dry run" : "Run"} prepared for ${selection.model.display}`);

    try {
      await prepareLaunchArtifacts(plan);
      this.state.run.snapshot = await loadRunSnapshot(plan, this.state.outputLines).catch(() => null);
      if (mode === "dry-run") {
        this.state.run.lifecycle = "complete";
        this.state.run.exitCode = 0;
        this.state.stage = "postrun";
        this.state.statusLine = "Dry run prepared. Nothing launched.";
        this.appendOutput("[grWizard] dry run complete - nothing launched");
        this.appendEvent("Dry run complete. Launch artifacts generated.");
        return;
      }

      if (!this.state.context.hardware.dockerComposeAvailable) {
        throw new Error("docker compose is not available on this host");
      }

      this.state.run.lifecycle = "building";
      this.state.statusLine = "Ensuring georefine:compress image is available";
      await this.ensureCompressImageInteractive(this.state.context.rootDir);
      if (this.state.run.cancelRequested) {
        this.state.run.lifecycle = "cancelled";
        this.state.stage = "postrun";
        this.state.statusLine = "Run cancelled before container start";
        this.appendEvent("Run cancelled before container start");
        return;
      }

      this.state.run.lifecycle = "starting";
      this.state.statusLine = "Starting Docker container";
      const child = spawnDockerRun(plan);
      this.state.run.child = child;
      this.state.run.lifecycle = "running";
      this.state.stage = "running";
      this.appendOutput(`[grWizard] docker run: docker ${plan.dockerArgs.join(" ")}`);
      this.appendEvent("Container launched. Monitoring progress and logs.");
      void this.consumeLines(child.stdout, (line) => this.appendOutput(line));
      void this.consumeLines(child.stderr, (line) => this.appendOutput(line));
      void this.waitForRunCompletion(child, plan);
      await this.refreshRuntime();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = this.state.run.cancelRequested || message.toLowerCase().includes("cancelled");
      this.state.run.exitCode = cancelled ? 130 : 1;
      this.state.run.lifecycle = cancelled ? "cancelled" : "failed";
      this.state.stage = "postrun";
      this.state.statusLine = cancelled ? "Run cancelled" : `Launch failed: ${message}`;
      this.appendOutput(`[grWizard] ${cancelled ? "cancelled" : "launch failed"}: ${message}`);
      this.appendEvent(cancelled ? "Run cancelled" : `Launch failed: ${message}`);
      if (this.state.run.quitAfterCancel) {
        this.state.shouldExit = true;
      }
    }
  }

  async waitForRunCompletion(child: Deno.ChildProcess, plan: LaunchPlan) {
    const status = await child.status;
    this.state.run.exitCode = status.code;
    this.state.run.child = null;
    await this.refreshRuntime();

    if (this.state.run.cancelRequested) {
      this.state.run.lifecycle = "cancelled";
      this.state.statusLine = "Run cancelled";
      this.appendEvent("Run cancelled");
    } else if (status.success) {
      this.state.run.lifecycle = "complete";
      this.state.statusLine = "Run complete";
      this.appendEvent("Run completed successfully");
    } else {
      this.state.run.lifecycle = "failed";
      this.state.statusLine = `Run exited with code ${status.code}`;
      this.appendEvent(`Run exited with code ${status.code}`);
    }

    this.state.stage = "postrun";
    this.state.run.plan = plan;
    if (this.state.run.quitAfterCancel) {
      this.state.shouldExit = true;
    }
  }

  async cancelRun(quitAfter = false) {
    if (!this.state.run.plan || this.state.run.lifecycle === "idle") {
      return;
    }
    this.state.run.cancelRequested = true;
    this.state.run.quitAfterCancel = quitAfter;
    this.state.run.lifecycle = "cancelling";
    this.state.statusLine = "Cancelling active run...";
    this.appendEvent(quitAfter ? "Cancelling active run and quitting" : "Cancelling active run");

    const containerName = this.state.run.plan.containerName;
    await new Deno.Command("docker", {
      args: ["kill", containerName],
      stdout: "null",
      stderr: "null",
    }).output().catch(() => undefined);

    try {
      this.state.run.child?.kill("SIGTERM");
    } catch {
      // ignore
    }
  }

  async consumeLines(stream: ReadableStream<Uint8Array> | null, onLine: (line: string) => void) {
    if (!stream) {
      return;
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        pending += decoder.decode(value, { stream: true });
        let newlineIndex = pending.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
          onLine(line);
          pending = pending.slice(newlineIndex + 1);
          newlineIndex = pending.indexOf("\n");
        }
      }
      pending += decoder.decode();
      const finalLine = pending.trim();
      if (finalLine) {
        onLine(finalLine);
      }
    } finally {
      reader.releaseLock();
    }
  }

  nextTab() {
    const index = tabs.findIndex((tab) => tab.id === this.state.activeTab);
    this.state.activeTab = tabs[(index + 1) % tabs.length]!.id;
  }

  previousStage() {
    switch (this.state.stage) {
      case "goal":
        this.state.stage = "model";
        this.state.activeTab = "launch";
        break;
      case "profile":
        this.state.stage = "goal";
        this.state.activeTab = "launch";
        break;
      case "review":
        this.state.stage = "profile";
        this.state.activeTab = "launch";
        break;
      default:
        break;
    }
  }

  async advanceStage() {
    if (!this.state.context) {
      return;
    }
    switch (this.state.stage) {
      case "scan":
        if (this.state.bootError) {
          await this.scanContext();
        }
        break;
      case "model":
        this.state.stage = "goal";
        break;
      case "goal":
        this.state.stage = "profile";
        break;
      case "profile":
        this.state.stage = "review";
        break;
      case "review":
        await this.startRun(this.options.defaultDryRun ? "dry-run" : "run");
        break;
      case "postrun":
        this.resetForNewRun();
        break;
      default:
        break;
    }
  }

  resetForNewRun() {
    this.state.stage = this.state.context ? "model" : "scan";
    this.state.activeTab = "launch";
    this.state.confirmKind = null;
    this.state.outputScroll = 0;
    this.state.run = {
      mode: null,
      lifecycle: "idle",
      startedAt: null,
      exitCode: null,
      child: null,
      plan: null,
      snapshot: null,
      cancelRequested: false,
      quitAfterCancel: false,
    };
    this.state.statusLine = "Ready for a new run";
    this.appendEvent("Ready for a new run");
  }

  moveSelection(delta: number) {
    const context = this.state.context;
    if (!context) {
      return;
    }
    if (this.state.stage === "model") {
      this.state.selectedModelIndex = clampIndex(this.state.selectedModelIndex + delta, context.candidates.length);
    } else if (this.state.stage === "goal") {
      this.state.selectedGoalIndex = clampIndex(this.state.selectedGoalIndex + delta, context.goals.length);
    } else if (this.state.stage === "profile") {
      this.state.selectedCalibrationIndex = clampIndex(
        this.state.selectedCalibrationIndex + delta,
        context.calibrations.length,
      );
    } else if (this.state.activeTab === "output") {
      const maxScroll = Math.max(0, this.state.outputLines.length - 1);
      this.state.outputScroll = Math.max(0, Math.min(maxScroll, this.state.outputScroll + delta));
    }
    this.state.numberBuffer = "";
  }

  jumpSelection(multiplier: number) {
    const context = this.state.context;
    if (!context) {
      return;
    }
    const delta = multiplier * 8;
    this.moveSelection(delta);
  }

  applyDigitSelection(digit: string) {
    const context = this.state.context;
    if (!context) {
      return;
    }
    const now = Date.now();
    if (now - this.state.numberBufferAt > INPUT_BUFFER_TIMEOUT_MS) {
      this.state.numberBuffer = digit;
    } else {
      this.state.numberBuffer = `${this.state.numberBuffer}${digit}`.slice(-3);
    }
    this.state.numberBufferAt = now;
    const value = Number.parseInt(this.state.numberBuffer, 10);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    const index = value - 1;
    if (this.state.stage === "model" && index < context.candidates.length) {
      this.state.selectedModelIndex = index;
    } else if (this.state.stage === "goal" && index < context.goals.length) {
      this.state.selectedGoalIndex = index;
    } else if (this.state.stage === "profile" && index < context.calibrations.length) {
      this.state.selectedCalibrationIndex = index;
    }
  }

  async handleKey(event: KeyPressEvent) {
    if (event.ctrl && event.key === "c") {
      this.state.shouldExit = true;
      return;
    }

    if (this.state.confirmKind) {
      if (event.key === "y" || event.key === "return") {
        const kind = this.state.confirmKind;
        this.state.confirmKind = null;
        await this.cancelRun(kind === "quit");
      } else if (event.key === "n" || event.key === "escape" || event.key === "q") {
        this.state.confirmKind = null;
        this.state.statusLine = "Cancel dismissed";
      }
      return;
    }

    if (this.state.showSplash) {
      if (event.key === "return" || event.key === "space" || event.key === "escape") {
        this.state.showSplash = false;
        this.state.splashDismissed = true;
      } else if (event.key === "q") {
        this.state.shouldExit = true;
      }
      return;
    }

    switch (event.key) {
      case "q":
        if (
          this.state.run.lifecycle === "running" || this.state.run.lifecycle === "building" ||
          this.state.run.lifecycle === "starting" || this.state.run.lifecycle === "cancelling"
        ) {
          this.state.confirmKind = "quit";
        } else {
          this.state.shouldExit = true;
        }
        return;
      case "tab":
        this.nextTab();
        return;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6": {
        if (
          this.state.activeTab === "launch" &&
          (this.state.stage === "model" || this.state.stage === "goal" || this.state.stage === "profile")
        ) {
          this.applyDigitSelection(event.key);
          return;
        }
        const tab = tabs[Number(event.key) - 1];
        if (tab) {
          this.state.activeTab = tab.id;
        }
        return;
      }
      case "r":
        if (this.state.run.lifecycle === "idle" || this.state.stage === "postrun" || this.state.stage === "scan") {
          await this.scanContext();
        }
        return;
      case "c":
      case "x":
        if (
          this.state.run.lifecycle === "running" || this.state.run.lifecycle === "building" ||
          this.state.run.lifecycle === "starting"
        ) {
          this.state.confirmKind = "cancel";
        }
        return;
      case "n":
        if (this.state.stage === "postrun") {
          this.resetForNewRun();
        }
        return;
      case "s":
        if (this.state.stage === "review") {
          await this.startRun("run");
        }
        return;
      case "d":
        if (this.state.stage === "review") {
          await this.startRun("dry-run");
        }
        return;
      case "b":
      case "left":
      case "backspace":
        this.previousStage();
        return;
      case "up":
        this.moveSelection(-1);
        return;
      case "down":
        this.moveSelection(1);
        return;
      case "pageup":
        this.jumpSelection(-1);
        return;
      case "pagedown":
        this.jumpSelection(1);
        return;
      case "home":
        this.jumpHome();
        return;
      case "end":
        this.jumpEnd();
        return;
      case "j":
        this.moveSelection(1);
        return;
      case "k":
        this.moveSelection(-1);
        return;
      case "return":
      case "space":
        await this.advanceStage();
        return;
      default:
        if (/^[0-9]$/.test(event.key)) {
          this.applyDigitSelection(event.key);
        }
        return;
    }
  }

  jumpHome() {
    const context = this.state.context;
    if (!context) {
      return;
    }
    if (this.state.stage === "model") {
      this.state.selectedModelIndex = 0;
    } else if (this.state.stage === "goal") {
      this.state.selectedGoalIndex = 0;
    } else if (this.state.stage === "profile") {
      this.state.selectedCalibrationIndex = 0;
    } else if (this.state.activeTab === "output") {
      this.state.outputScroll = Math.max(0, this.state.outputLines.length - 1);
    }
  }

  jumpEnd() {
    const context = this.state.context;
    if (!context) {
      return;
    }
    if (this.state.stage === "model") {
      this.state.selectedModelIndex = Math.max(0, context.candidates.length - 1);
    } else if (this.state.stage === "goal") {
      this.state.selectedGoalIndex = Math.max(0, context.goals.length - 1);
    } else if (this.state.stage === "profile") {
      this.state.selectedCalibrationIndex = Math.max(0, context.calibrations.length - 1);
    } else if (this.state.activeTab === "output") {
      this.state.outputScroll = 0;
    }
  }

  async readInputLoop() {
    const buffer = new Uint8Array(1024);
    let pending = new Uint8Array(0);

    while (!this.state.shouldExit) {
      const size = await Deno.stdin.read(buffer);
      if (size == null) {
        break;
      }
      const next = size === buffer.length ? buffer : buffer.slice(0, size);
      const merged = pending.length > 0 ? concatBuffers(pending, next) : next;
      const { complete, remainder } = splitInputBuffer(merged);
      pending = new Uint8Array(remainder);
      for (const decoded of decodeBuffer(complete)) {
        if (decoded.key === "mouse" || decoded.key === "paste" || decoded.key === "focus") {
          continue;
        }
        const keyPress = { ...decoded } satisfies KeyPressEvent;
        await this.handleKey(keyPress);
        if (this.state.shouldExit) {
          break;
        }
      }
      if (!this.state.showSplash && this.state.context && Date.now() >= this.splashMinUntil) {
        this.state.showSplash = false;
      }
      this.render();
    }
  }

  render() {
    const width = this.width();
    const height = this.height();
    const buffer = new ScreenBuffer(width, height);

    if (this.state.showSplash) {
      this.renderSplash(buffer);
    } else {
      this.renderHeader(buffer);
      this.renderBody(buffer);
      this.renderFooter(buffer);
      if (this.state.confirmKind) {
        this.renderConfirm(buffer);
      }
    }

    const frame = `${HIDE_CURSOR}${moveCursor(0, 0)}${buffer.render()}\x1b[J`;
    if (frame !== this.#lastFrame) {
      Deno.stdout.writeSync(encoder.encode(frame));
      this.#lastFrame = frame;
    }
  }

  renderSplash(buffer: ScreenBuffer) {
    const width = buffer.width;
    const height = buffer.height;
    const art = wizardFrames[this.state.splashFrame % wizardFrames.length]!;
    const overall = Math.max(bootProgress(this.state.bootSteps), clamp((Date.now() - this.startedAt) / BOOT_MIN_MS));
    const lines = [
      ...art,
      "",
      ...splashTitle,
      "",
      "GeoRefine Wizard",
      "",
      this.state.bootNote,
      `${Math.round(overall * 100)}% ${progressBar(overall, Math.max(18, Math.min(48, width - 20)))}`,
      this.state.bootError ? `ERROR: ${this.state.bootError}` : "Press Enter to continue",
    ];

    const totalHeight = lines.length;
    const startY = Math.max(0, Math.floor((height - totalHeight) / 2));
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const x = Math.max(0, Math.floor((width - line.length) / 2));
      const style = index < art.length
        ? styles.signal
        : index < art.length + 1 + splashTitle.length
        ? styles.amber
        : undefined;
      buffer.write(x, startY + index, crop(line, width - x), style);
    }
    if (height > 2) {
      buffer.write(
        Math.max(0, Math.floor((width - 34) / 2)),
        height - 2,
        crop("[enter/space] continue  [q] quit", width),
        styles.dim,
      );
    }
  }

  renderHeader(buffer: ScreenBuffer) {
    const context = this.state.context;
    const system = safeSystemSnapshot(this.systemMonitor);
    const line0 = `grWizard  GeoRefine Wizard  ${stageLabel(this.state.stage)} / ${
      runLabel(this.state.run.lifecycle)
    }  ${this.state.statusLine}`;
    buffer.write(0, 0, crop(line0, buffer.width), styles.heading);

    const rig = context
      ? `CPU ${context.hardware.cpuCores}  RAM ${context.hardware.systemRamGb}G  GPU ${context.hardware.gpuName} ${context.hardware.gpuVramGb}G  HF ${
        context.hardware.hfAuthLoaded ? "loaded" : "none"
      }  Docker ${context.hardware.dockerComposeAvailable ? "ok" : "missing"}  Load ${
        system.loadavg.map((value: number) => value.toFixed(2)).join("/")
      }`
      : "Waiting for hardware scan...";
    buffer.write(0, 1, crop(rig, buffer.width), styles.dim);

    const right = `Time ${formatDuration((Date.now() - this.startedAt) / 1000)}`;
    const reserved = buffer.width > right.length + 2 ? right.length + 2 : 0;
    let cursor = 0;
    tabs.forEach((tab, index) => {
      const label = `[${index + 1}] ${buffer.width < 140 ? tab.short : tab.label}`;
      if (reserved > 0 && cursor + label.length > buffer.width - reserved) {
        return;
      }
      const style = this.state.activeTab === tab.id ? titleStyle(tab.id) : styles.dim;
      buffer.write(cursor, 2, crop(label, Math.max(0, buffer.width - cursor)), style);
      cursor += label.length + 2;
      if (cursor < buffer.width) {
        buffer.write(cursor - 2, 2, "  ", undefined);
      }
    });
    if (reserved > 0) {
      buffer.write(Math.max(0, buffer.width - right.length), 2, right, styles.dim);
    }
  }

  renderBody(buffer: ScreenBuffer) {
    const body = { x: 0, y: 4, width: buffer.width, height: Math.max(0, buffer.height - 7) };
    switch (this.state.activeTab) {
      case "launch":
        this.renderLaunchTab(buffer, body);
        break;
      case "overview":
        this.renderOverviewTab(buffer, body);
        break;
      case "board":
        this.renderBoardTab(buffer, body);
        break;
      case "output":
        this.renderOutputTab(buffer, body);
        break;
      case "model":
        this.renderModelTab(buffer, body);
        break;
      case "goal":
        this.renderGoalTab(buffer, body);
        break;
    }
  }

  renderFooter(buffer: ScreenBuffer) {
    if (buffer.height < 2) {
      return;
    }
    buffer.write(0, buffer.height - 2, crop(footerForStage(this.state), buffer.width), styles.dim);
    if (this.state.numberBuffer) {
      const info = `selection #${this.state.numberBuffer}`;
      buffer.write(Math.max(0, buffer.width - info.length), buffer.height - 2, info, styles.dim);
    }
    if (buffer.height >= 1) {
      const eventLine = this.state.recentEvents[this.state.recentEvents.length - 1] ?? "";
      buffer.write(0, buffer.height - 1, crop(eventLine, buffer.width), styles.dim);
    }
  }

  renderConfirm(buffer: ScreenBuffer) {
    const width = Math.min(58, Math.max(34, buffer.width - 12));
    const height = 7;
    const rect: Rect = {
      x: Math.max(0, Math.floor((buffer.width - width) / 2)),
      y: Math.max(3, Math.floor((buffer.height - height) / 2)),
      width,
      height,
    };
    buffer.box(rect, this.state.confirmKind === "quit" ? "Cancel + Quit" : "Cancel Run", "alarm");
    const message = this.state.confirmKind === "quit"
      ? "Cancel the active GeoRefine run and quit grWizard?"
      : "Cancel the active GeoRefine run?";
    const inner = inset(rect, 2, 2);
    const lines = [...wrap(message, inner.width), "", "[y] confirm   [n/esc] stay"];
    buffer.textBlock(inner, lines);
  }

  renderLaunchTab(buffer: ScreenBuffer, rect: Rect) {
    const viewport = detectViewportClass(rect.width, rect.height);
    if (this.state.stage === "scan") {
      this.renderScanStage(buffer, rect);
      return;
    }
    if (this.state.stage === "running") {
      this.renderRunningLaunch(buffer, rect);
      return;
    }
    if (this.state.stage === "postrun") {
      this.renderPostrun(buffer, rect);
      return;
    }

    if (viewport === "tiny") {
      this.renderLaunchSingle(buffer, rect);
      return;
    }

    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.58));
    this.renderLaunchSingle(buffer, left);

    const rightRows = stackRows(right, 2);
    this.drawSelectionSummary(buffer, rightRows[0] ?? hiddenRect());
    this.drawVisualizationPanel(
      buffer,
      rightRows[1] ?? hiddenRect(),
      this.state.stage === "model" ? "route-board" : this.state.stage === "goal" ? "magi-board" : "gate-status",
      this.state.stage === "model"
        ? "Model Telemetry"
        : this.state.stage === "goal"
        ? "Goal Geometry"
        : "Launch Signals",
    );
  }

  renderLaunchSingle(buffer: ScreenBuffer, rect: Rect) {
    switch (this.state.stage) {
      case "model":
        this.drawModelPicker(buffer, rect);
        break;
      case "goal":
        this.drawGoalPicker(buffer, rect);
        break;
      case "profile":
        this.drawProfilePicker(buffer, rect);
        break;
      case "review":
        this.drawReview(buffer, rect);
        break;
      default:
        this.renderScanStage(buffer, rect);
        break;
    }
  }

  renderScanStage(buffer: ScreenBuffer, rect: Rect) {
    const [top, bottom] = splitRows(rect, Math.max(9, Math.floor(rect.height * 0.45)));
    buffer.box(top, "System Scan", "signal");
    const topInner = inset(top, 2, 2);
    const progress = bootProgress(this.state.bootSteps);
    const lines = [
      this.state.bootError ? `ERROR: ${this.state.bootError}` : this.state.bootNote,
      "",
      `${Math.round(progress * 100)}%  ${progressBar(progress, Math.max(10, topInner.width - 8))}`,
      "",
      ...this.state.bootSteps.map((step, index) =>
        `${
          step.done ? "[x]" : this.state.bootSteps.slice(0, index).every((item) => item.done) ? "[>]" : "[ ]"
        } ${step.label}`
      ),
    ];
    buffer.textBlock(topInner, lines, this.state.bootError ? styles.error : undefined);

    buffer.box(bottom, "Next", "amber");
    const bottomInner = inset(bottom, 2, 2);
    const helpLines = this.state.bootError
      ? wrap(
        "The scan failed. Press r to retry after fixing the GeoRefine path, Docker, or model catalog issue.",
        bottomInner.width,
      )
      : wrap(
        "Once the scan finishes, grWizard will recommend viable local or Hugging Face models based on your actual CPU, RAM, GPU, and VRAM.",
        bottomInner.width,
      );
    buffer.textBlock(bottomInner, helpLines);
  }

  renderRunningLaunch(buffer: ScreenBuffer, rect: Rect) {
    const rows = stackRows(rect, detectViewportClass(rect.width, rect.height) === "tiny" ? 2 : 3);
    this.drawSelectionSummary(buffer, rows[0] ?? hiddenRect(), this.state.run.snapshot);
    if (rows[1]) {
      this.drawRunSummary(buffer, rows[1], this.state.run.snapshot);
    }
    if (rows[2]) {
      this.drawVisualizationPanel(buffer, rows[2], "telemetry-rack", "Runtime Telemetry");
    }
  }

  renderPostrun(buffer: ScreenBuffer, rect: Rect) {
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      this.drawRunSummary(buffer, rect, this.state.run.snapshot, true);
      return;
    }
    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.56));
    this.drawRunSummary(buffer, left, this.state.run.snapshot, true);
    const rightRows = stackRows(right, 2);
    this.drawSelectionSummary(buffer, rightRows[0] ?? hiddenRect(), this.state.run.snapshot);
    this.drawVisualizationPanel(buffer, rightRows[1] ?? hiddenRect(), "warning-stack", "Result Field");
  }

  drawModelPicker(buffer: ScreenBuffer, rect: Rect) {
    const context = this.state.context;
    if (!context) {
      this.renderScanStage(buffer, rect);
      return;
    }
    buffer.box(rect, "Step 1 - Model Fit", "amber");
    const inner = inset(rect, 2, 2);
    const header = `Recommended: #${this.state.selectedModelIndex + 1} ${
      context.candidates[this.state.selectedModelIndex]?.display ?? "-"
    }`;
    buffer.write(inner.x, inner.y, crop(header, inner.width), styles.heading);
    const listTop = inner.y + 2;
    const capacity = Math.max(1, inner.height - 3);
    const range = windowRange(context.candidates.length, this.state.selectedModelIndex, capacity);
    for (let line = 0; line < range.end - range.start; line += 1) {
      const index = range.start + line;
      const candidate = context.candidates[index]!;
      const row = [
        String(index + 1).padStart(2, "0"),
        fitLabel(candidate.fit).padEnd(8),
        candidate.source.padEnd(10),
        (candidate.minVramGb == null ? "-" : `${candidate.minVramGb}G`).padStart(4),
        crop(candidate.display, Math.max(8, inner.width - 31)),
      ].join(" ");
      const y = listTop + line;
      const selected = index === this.state.selectedModelIndex;
      buffer.write(
        inner.x,
        y,
        pad(crop(`${selected ? ">" : " "} ${row}`, inner.width), inner.width),
        selected ? selectionStyle("amber") : undefined,
      );
    }
  }

  drawGoalPicker(buffer: ScreenBuffer, rect: Rect) {
    const context = this.state.context;
    if (!context) {
      return;
    }
    buffer.box(rect, "Step 2 - Run Goal", "amber");
    const inner = inset(rect, 2, 2);
    const capacity = Math.max(1, inner.height - 1);
    const range = windowRange(context.goals.length, this.state.selectedGoalIndex, capacity);
    for (let line = 0; line < range.end - range.start; line += 1) {
      const index = range.start + line;
      const goal = context.goals[index]!;
      const row = `${
        String(index + 1).padStart(2, "0")
      } ${goal.label}  ${goal.template}  thr=${goal.threshold}  cal=${goal.calTokens}  sweeps=${goal.sweeps}`;
      const y = inner.y + line;
      buffer.write(
        inner.x,
        y,
        pad(crop(`${index === this.state.selectedGoalIndex ? ">" : " "} ${row}`, inner.width), inner.width),
        index === this.state.selectedGoalIndex ? selectionStyle("amber") : undefined,
      );
    }
  }

  drawProfilePicker(buffer: ScreenBuffer, rect: Rect) {
    const context = this.state.context;
    const selection = currentSelection(this.state);
    if (!context || !selection) {
      return;
    }
    buffer.box(rect, "Step 3 - Calibration Profile", "amber");
    const inner = inset(rect, 2, 2);
    const capacity = Math.max(1, inner.height - 4);
    const range = windowRange(context.calibrations.length, this.state.selectedCalibrationIndex, capacity);
    for (let line = 0; line < range.end - range.start; line += 1) {
      const index = range.start + line;
      const profile = context.calibrations[index]!;
      const applied = applyCalibrationProfile(selection.goal, profile.id);
      const row = `${
        String(index + 1).padStart(2, "0")
      } ${profile.label}  cal=${applied.effectiveCalTokens}  proxy=${applied.effectiveProxyTokens}`;
      const y = inner.y + line;
      buffer.write(
        inner.x,
        y,
        pad(crop(`${index === this.state.selectedCalibrationIndex ? ">" : " "} ${row}`, inner.width), inner.width),
        index === this.state.selectedCalibrationIndex ? selectionStyle("amber") : undefined,
      );
    }
    const current = context.calibrations[this.state.selectedCalibrationIndex]!;
    const noteLines = wrap(current.description, inner.width).slice(0, Math.max(0, inner.height - capacity - 1));
    buffer.textBlock(
      { x: inner.x, y: inner.y + capacity + 1, width: inner.width, height: Math.max(0, inner.height - capacity - 1) },
      noteLines,
      styles.dim,
    );
  }

  drawReview(buffer: ScreenBuffer, rect: Rect) {
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      this.drawSelectionSummary(buffer, rect);
      return;
    }
    const [top, bottom] = splitRows(rect, Math.max(12, Math.floor(rect.height * 0.65)));
    this.drawSelectionSummary(buffer, top);
    buffer.box(bottom, "Actions", "phosphor");
    const inner = inset(bottom, 2, 2);
    const defaultAction = this.options.defaultDryRun ? "Prepare dry run [Enter]" : "Start full run [Enter]";
    const lines = [
      defaultAction,
      "Start full run [s]",
      "Prepare dry run [d]",
      "Back [b]",
      "Quit [q]",
    ];
    buffer.textBlock(inner, lines);
  }

  drawSelectionSummary(buffer: ScreenBuffer, rect: Rect, snapshot?: RunSnapshot | null) {
    const selection = currentSelection(this.state);
    if (!selection || rect.width < 4 || rect.height < 4) {
      return;
    }
    buffer.box(rect, "Selection Summary", "signal");
    const inner = inset(rect, 2, 2);
    const model = selection.model;
    const goal = selection.goal;
    const applied = selection.applied;
    const lines = [
      `Model        ${model.display}`,
      `Source       ${model.source}`,
      `Fit          ${model.fit}`,
      `VRAM need    ${model.minVramGb == null ? "-" : `${model.minVramGb} GiB`}`,
      `Goal         ${goal.label}`,
      `Template     ${goal.template}`,
      `Threshold    ${goal.threshold}`,
      `Cal tokens   ${applied.effectiveCalTokens}`,
      `Proxy tokens ${applied.effectiveProxyTokens}`,
      `Sweeps       ${goal.sweeps}`,
      `Strict       ${humanBool(goal.strict)}`,
      `Autonomous   ${humanBool(goal.autonomous)}`,
      snapshot ? `Current task ${snapshot.currentTask}` : model.notes ? `Notes        ${model.notes}` : "",
    ].filter(Boolean);
    buffer.textBlock(inner, lines.slice(0, inner.height));
  }

  drawRunSummary(buffer: ScreenBuffer, rect: Rect, snapshot?: RunSnapshot | null, postrun = false) {
    buffer.box(rect, postrun ? "Run Result" : "Run Status", "signal");
    const inner = inset(rect, 2, 2);
    const plan = this.state.run.plan;
    const progress = snapshot?.progress;
    const result = snapshot?.result;
    const actionLine = postrun || (
        this.state.run.lifecycle !== "running" &&
        this.state.run.lifecycle !== "building" &&
        this.state.run.lifecycle !== "starting" &&
        this.state.run.lifecycle !== "cancelling"
      )
      ? "[n] new run  [r] rescan  [q] quit"
      : "[c] cancel  [1-6/tab] switch panels";
    const lines = [
      `Lifecycle      ${runLabel(this.state.run.lifecycle)}`,
      `Mode           ${this.state.run.mode ?? "-"}`,
      `Run tag        ${plan?.runTag ?? "-"}`,
      `Progress       ${
        progress
          ? `${progress.overallProgressPct.toFixed(0)}%`
          : snapshot
          ? `${(snapshot.progressRatio * 100).toFixed(0)}%`
          : "-"
      }`,
      `Phase          ${snapshot?.currentPhase ?? "-"}`,
      `Current task   ${snapshot?.currentTask ?? "-"}`,
      `Model load     ${progressBar(snapshot?.modelLoadRatio ?? 0, Math.max(8, Math.min(24, inner.width - 16)))} ${
        Math.round((snapshot?.modelLoadRatio ?? 0) * 100)
      }%`,
      `Data load      ${progressBar(snapshot?.dataLoadRatio ?? 0, Math.max(8, Math.min(24, inner.width - 16)))} ${
        Math.round((snapshot?.dataLoadRatio ?? 0) * 100)
      }%`,
      result ? `Run status     ${result.runStatus}` : "",
      result?.artifactKind ? `Artifact       ${result.artifactKind}` : "",
      result?.saveDir ? `Save dir       ${result.saveDir}` : "",
      result?.degradation != null ? `Degradation    ${result.degradation}` : "",
      postrun ? "" : "",
      actionLine,
    ].filter(Boolean);
    buffer.textBlock(inner, lines.slice(0, inner.height));
  }

  drawVisualizationPanel(buffer: ScreenBuffer, rect: Rect, visualizationId: string, title: string) {
    if (rect.width < 8 || rect.height < 6) {
      return;
    }
    const system = safeSystemSnapshot(this.systemMonitor);
    const rendered = renderVisualizationBody(visualizationId, rect.width - 4, rect.height - 4, this.state, system);
    buffer.box(rect, title, rendered.accent);
    buffer.textBlock(inset(rect, 2, 2), rendered.lines);
  }

  renderOverviewTab(buffer: ScreenBuffer, rect: Rect) {
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      const rows = stackRows(rect, 3);
      this.drawRunSummary(buffer, rows[0] ?? hiddenRect(), this.state.run.snapshot);
      this.drawVisualizationPanel(buffer, rows[1] ?? hiddenRect(), "telemetry-rack", "Telemetry Rack");
      this.drawAlerts(buffer, rows[2] ?? hiddenRect());
      return;
    }
    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.5));
    const leftRows = stackRows(left, 2);
    this.drawRunSummary(buffer, leftRows[0] ?? hiddenRect(), this.state.run.snapshot);
    this.drawAlerts(buffer, leftRows[1] ?? hiddenRect());
    const rightRows = stackRows(right, 2);
    this.drawVisualizationPanel(buffer, rightRows[0] ?? hiddenRect(), "telemetry-rack", "Telemetry Rack");
    if (viewport === "large") {
      const columns = stackColumns(rightRows[1] ?? hiddenRect(), 2);
      this.drawBoardPreview(buffer, columns[0] ?? hiddenRect());
      this.drawOutputPreview(buffer, columns[1] ?? hiddenRect());
    } else {
      this.drawOutputPreview(buffer, rightRows[1] ?? hiddenRect());
    }
  }

  drawAlerts(buffer: ScreenBuffer, rect: Rect) {
    buffer.box(rect, "Alerts + Events", "amber");
    const inner = inset(rect, 2, 2);
    const alerts = this.state.run.snapshot?.alerts ?? [];
    const lines = alerts.length > 0 ? alerts : this.state.recentEvents.slice(-Math.max(1, inner.height));
    buffer.textBlock(inner, lines.slice(-Math.max(1, inner.height)));
  }

  drawBoardPreview(buffer: ScreenBuffer, rect: Rect) {
    buffer.box(rect, "Board Preview", "phosphor");
    const inner = inset(rect, 2, 2);
    const board = this.state.run.snapshot?.board;
    const lines = board
      ? [
        summarizeBoard(board),
        "",
        ...board.active.slice(0, Math.max(0, inner.height - 2)).map((task: RunBoard["active"][number]) =>
          `${task.id} ${crop(task.note || task.status, Math.max(0, inner.width - task.id.length - 1))}`
        ),
      ]
      : ["No live swarm board yet."];
    buffer.textBlock(inner, lines);
  }

  drawOutputPreview(buffer: ScreenBuffer, rect: Rect) {
    buffer.box(rect, "Recent Output", "signal");
    const inner = inset(rect, 2, 2);
    const lines = this.state.outputLines.slice(-(Math.max(1, inner.height)));
    buffer.textBlock(inner, lines);
  }

  renderBoardTab(buffer: ScreenBuffer, rect: Rect) {
    const board = this.state.run.snapshot?.board;
    if (!board) {
      buffer.box(rect, "Board", "phosphor");
      buffer.textBlock(inset(rect, 2, 2), ["Launch a run to populate the live swarm kanban board."]);
      return;
    }
    const viewport = detectViewportClass(rect.width, rect.height);
    const columnDefs: Array<[keyof RunBoard, string]> = [
      ["backlog", "Backlog"],
      ["active", "Active"],
      ["review", "Review"],
      ["done", "Done"],
    ];
    const columns = viewport === "tiny" ? stackRows(rect, 4) : stackColumns(rect, 4);
    columnDefs.forEach(([key, title], index) => {
      const panel = columns[index] ?? hiddenRect();
      buffer.box(
        panel,
        `${title} (${board[key].length})`,
        key === "active" ? "signal" : key === "done" ? "phosphor" : key === "review" ? "amber" : "violet",
      );
      const inner = inset(panel, 2, 2);
      const lines = board[key].slice(0, inner.height).map((task: RunBoard["active"][number]) =>
        `${crop(task.id, 12)} ${crop(task.note || task.status, Math.max(0, inner.width - 13))}`
      );
      buffer.textBlock(inner, lines.length > 0 ? lines : ["-"]);
    });
  }

  renderOutputTab(buffer: ScreenBuffer, rect: Rect) {
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      buffer.box(rect, "Raw Output", "signal");
      const inner = inset(rect, 2, 2);
      const tailLines = this.visibleOutputLines(inner.height);
      buffer.textBlock(inner, tailLines);
      return;
    }
    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.58));
    buffer.box(left, "Console Stream", "signal");
    buffer.textBlock(inset(left, 2, 2), this.visibleOutputLines(Math.max(1, left.height - 4)));
    const rightRows = stackRows(right, 2);
    buffer.box(rightRows[0] ?? hiddenRect(), "Swarm Log Tail", "amber");
    buffer.textBlock(
      inset(rightRows[0] ?? hiddenRect(), 2, 2),
      (this.state.run.snapshot?.swarmTail ?? ["No swarm output yet."]).slice(
        -Math.max(1, (rightRows[0]?.height ?? 4) - 4),
      ),
    );
    buffer.box(rightRows[1] ?? hiddenRect(), "GeoRefine Tail", "violet");
    buffer.textBlock(
      inset(rightRows[1] ?? hiddenRect(), 2, 2),
      (this.state.run.snapshot?.georefineTail ?? ["No GeoRefine log yet."]).slice(
        -Math.max(1, (rightRows[1]?.height ?? 4) - 4),
      ),
    );
  }

  visibleOutputLines(height: number) {
    const all = this.state.outputLines;
    if (all.length <= height) {
      return all;
    }
    const maxStart = Math.max(0, all.length - height);
    const start = Math.max(0, maxStart - this.state.outputScroll);
    return all.slice(start, start + height);
  }

  renderModelTab(buffer: ScreenBuffer, rect: Rect) {
    const selection = currentSelection(this.state);
    if (!selection) {
      this.renderScanStage(buffer, rect);
      return;
    }
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      this.drawSelectionSummary(buffer, rect, this.state.run.snapshot);
      return;
    }
    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.5));
    buffer.box(left, "Model Stats", "violet");
    const inner = inset(left, 2, 2);
    const model = selection.model;
    const context = this.state.context!;
    const system = safeSystemSnapshot(this.systemMonitor);
    const lines = [
      `Model          ${model.display}`,
      `Family         ${model.family}`,
      `Source         ${model.source}`,
      `Reference      ${model.ref}`,
      `Container ref  ${model.containerRef}`,
      `Fit            ${model.fit}`,
      `Params         ${formatParams(model)}`,
      `Min VRAM       ${model.minVramGb == null ? "-" : `${model.minVramGb} GiB`}`,
      `Local only     ${humanBool(model.localOnly)}`,
      `Remote code    ${humanBool(model.remoteCode)}`,
      `Gated          ${humanBool(model.gated)}`,
      `Device         ${context.hardware.deviceDefault}`,
      `Host CPU       ${context.hardware.cpuCores} cores`,
      `Host RAM       ${context.hardware.systemRamGb} GiB`,
      `Host GPU       ${context.hardware.gpuName}`,
      `Host VRAM      ${context.hardware.gpuVramGb} GiB`,
      `CPU now        ${formatPercent(system.cpuOverall)}`,
      `Memory now     ${formatPercent(system.memory.percent)}`,
      model.notes ? `Notes          ${model.notes}` : "",
    ].filter(Boolean);
    buffer.textBlock(inner, lines.slice(0, inner.height));
    this.drawVisualizationPanel(buffer, right, "cpu-monitor", "System Monitor");
  }

  renderGoalTab(buffer: ScreenBuffer, rect: Rect) {
    const selection = currentSelection(this.state);
    if (!selection) {
      this.renderScanStage(buffer, rect);
      return;
    }
    const viewport = detectViewportClass(rect.width, rect.height);
    if (viewport === "tiny") {
      this.drawSelectionSummary(buffer, rect, this.state.run.snapshot);
      return;
    }
    const [left, right] = splitColumns(rect, Math.floor(rect.width * 0.5));
    buffer.box(left, "Goal Stats", "amber");
    const inner = inset(left, 2, 2);
    const goal = selection.goal;
    const applied = selection.applied;
    const lines = [
      `Goal            ${goal.label}`,
      `Template        ${goal.template}`,
      `Threshold       ${goal.threshold}`,
      `Cal tokens      ${goal.calTokens}`,
      `Proxy tokens    ${goal.proxyTokens}`,
      `Effective cal   ${applied.effectiveCalTokens}`,
      `Effective proxy ${applied.effectiveProxyTokens}`,
      `Sweeps          ${goal.sweeps}`,
      `Strict          ${humanBool(goal.strict)}`,
      `Autonomous      ${humanBool(goal.autonomous)}`,
      `Monitor         ${goal.monitorInterval}s`,
      `Calibration     ${selection.calibrationProfile.label}`,
      "",
      ...wrap(goal.description, inner.width),
      this.state.run.plan ? "" : "",
      this.state.run.plan ? `Run tag         ${this.state.run.plan.runTag}` : "",
    ].filter((line) => line !== "");
    buffer.textBlock(inner, lines.slice(0, inner.height));
    this.drawVisualizationPanel(buffer, right, "magi-board", "Goal Geometry");
  }
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
}

function splitInputBuffer(buffer: Uint8Array) {
  let end = 0;
  let nextIndex = 0;
  while (nextIndex < buffer.length) {
    const boundary = nextInputBoundary(buffer, nextIndex);
    if (boundary == null) {
      break;
    }
    end = boundary;
    nextIndex = boundary;
  }
  return {
    complete: buffer.subarray(0, end),
    remainder: buffer.subarray(end),
  };
}

function nextInputBoundary(buffer: Uint8Array, start: number): number | null {
  const first = buffer[start];
  if (first == null) {
    return null;
  }
  if (first !== 0x1b) {
    const width = utf8ByteWidth(first);
    return start + width <= buffer.length ? start + width : null;
  }
  const second = buffer[start + 1];
  if (second == null) {
    return null;
  }
  if (second === 0x1b) {
    return start + 1;
  }
  if (second === 0x5b) {
    const third = buffer[start + 2];
    if (third == null) {
      return null;
    }
    if (third === 0x4d) {
      return start + 6 <= buffer.length ? start + 6 : null;
    }
    if (third === 0x3c) {
      for (let index = start + 3; index < buffer.length; index += 1) {
        const byte = buffer[index];
        if (byte === 0x4d || byte === 0x6d) {
          return index + 1;
        }
      }
      return null;
    }
    return scanEscapeSequence(buffer, start + 2);
  }
  if (second === 0x4f) {
    return scanEscapeSequence(buffer, start + 2);
  }
  const width = utf8ByteWidth(second);
  return start + 1 + width <= buffer.length ? start + 1 + width : null;
}

function scanEscapeSequence(buffer: Uint8Array, start: number): number | null {
  for (let index = start; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte >= 0x40 && byte <= 0x7e) {
      return index + 1;
    }
  }
  return null;
}

function utf8ByteWidth(byte: number) {
  if ((byte & 0x80) === 0) {
    return 1;
  }
  if ((byte & 0xe0) === 0xc0) {
    return 2;
  }
  if ((byte & 0xf0) === 0xe0) {
    return 3;
  }
  if ((byte & 0xf8) === 0xf0) {
    return 4;
  }
  return 1;
}

function concatBuffers(left: Uint8Array, right: Uint8Array) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runListOnly(options: CliOptions) {
  const rootDir = await resolveGeoRefineRoot(options.rootOverride);
  const localEnv = await loadLocalEnv(`${rootDir}/grWizard/.env.local`);
  const hardware = await detectHardware(localEnv, rootDir);
  const catalog = await loadModelCatalog(`${rootDir}/grWizard/model_catalog.json`);
  const candidates = sortCandidatesForDisplay(await discoverModelCandidates(rootDir, catalog, hardware));
  const recommendedIndex = recommendModelIndex(candidates);

  console.log("grWizard - list only");
  console.log("");
  console.log("Hardware Summary");
  console.log(`  CPU cores : ${hardware.cpuCores}`);
  console.log(`  System RAM: ${hardware.systemRamGb} GiB`);
  console.log(`  GPU       : ${hardware.gpuName}`);
  console.log(`  GPU VRAM  : ${hardware.gpuVramGb} GiB`);
  console.log(`  Default   : ${hardware.deviceDefault}`);
  console.log(`  HF auth   : ${hardware.hfAuthLoaded ? "loaded" : "none"}`);
  console.log("");
  console.log("Model Candidates");
  candidates.forEach((candidate, index) => {
    const marker = index === recommendedIndex ? "*" : " ";
    console.log(
      `${marker} ${String(index + 1).padStart(2, "0")}  ${fitLabel(candidate.fit).padEnd(8)}  ${
        candidate.source.padEnd(10)
      }  ${candidate.display}`,
    );
  });
}

export async function main(args = Deno.args) {
  let options: CliOptions;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    Deno.exit(1);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  if (options.listOnly) {
    await runListOnly(options);
    return;
  }

  const app = new ImmediateWizardApp(options);
  await app.run();
}

if (import.meta.main) {
  await main();
}
