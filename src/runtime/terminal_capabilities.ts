// Copyright 2023 Im-Beast. MIT license.

/** Color fidelity available for terminal output. */
export type TerminalColorDepth = "none" | "ansi16" | "ansi256" | "truecolor";

/** Mouse input protocol that should be enabled for the current terminal. */
export type TerminalMouseProtocol = "none" | "x10" | "vt200" | "sgr";

/** Text rendering strategy selected from terminal capabilities. */
export type TerminalTextMode = "ascii" | "unicode";

/** Stable identifier for one terminal capability flag. */
export type TerminalCapabilityId =
  | "interactive"
  | "unicode"
  | "hyperlinks"
  | "mouse"
  | "sgrMouse"
  | "bracketedPaste"
  | "focusEvents"
  | "alternateScreen"
  | "cursorShape";

/** Optional terminal capabilities that affect input, output, and renderer setup. */
export interface TerminalCapabilities {
  interactive: boolean;
  colorDepth: TerminalColorDepth;
  unicode: boolean;
  hyperlinks: boolean;
  mouse: boolean;
  sgrMouse: boolean;
  bracketedPaste: boolean;
  focusEvents: boolean;
  alternateScreen: boolean;
  cursorShape: boolean;
}

/** Display metadata for one terminal capability. */
export interface TerminalCapabilityEntry {
  id: TerminalCapabilityId;
  label: string;
  available: boolean;
  description: string;
}

/** Aggregate terminal capability probe result for diagnostics and settings panes. */
export interface TerminalCapabilitySummary {
  total: number;
  available: number;
  missing: number;
  colorDepth: TerminalColorDepth;
  entries: TerminalCapabilityEntry[];
}

/** Options for terminal detection. Values are injectable for deterministic tests and non-Deno runtimes. */
export interface TerminalCapabilityDetectionOptions {
  env?: Record<string, string | undefined> | ((name: string) => string | undefined);
  isTty?: boolean;
  noColor?: boolean;
  forceColor?: boolean | string;
  platform?: string;
}

/** Preferences for deriving terminal behavior from detected capabilities. */
export interface TerminalPlanOptions {
  preferUnicode?: boolean;
  preferMouse?: boolean;
  preferAlternateScreen?: boolean;
  preferBracketedPaste?: boolean;
  preferFocusEvents?: boolean;
  preferHyperlinks?: boolean;
  minimumColorDepth?: TerminalColorDepth;
}

/** Deterministic terminal behavior plan for apps, demos, and input readers. */
export interface TerminalPlan {
  capabilities: TerminalCapabilities;
  colorDepth: TerminalColorDepth;
  textMode: TerminalTextMode;
  mouseProtocol: TerminalMouseProtocol;
  alternateScreen: boolean;
  bracketedPaste: boolean;
  focusEvents: boolean;
  hyperlinks: boolean;
  cursorShape: boolean;
  reasons: string[];
}

const TERMINAL_CAPABILITY_METADATA: Record<
  TerminalCapabilityId,
  Omit<TerminalCapabilityEntry, "id" | "available">
> = {
  interactive: {
    label: "Interactive TTY",
    description: "Stdout is attached to an interactive terminal.",
  },
  unicode: {
    label: "Unicode",
    description: "Terminal environment is suitable for box drawing, glyphs, and wide text.",
  },
  hyperlinks: {
    label: "OSC 8 Hyperlinks",
    description: "Terminal is likely to support clickable OSC 8 hyperlinks.",
  },
  mouse: {
    label: "Mouse Input",
    description: "Terminal can report mouse presses or scroll events.",
  },
  sgrMouse: {
    label: "SGR Mouse",
    description: "Terminal can report extended SGR mouse coordinates.",
  },
  bracketedPaste: {
    label: "Bracketed Paste",
    description: "Terminal can distinguish pasted text from typed keys.",
  },
  focusEvents: {
    label: "Focus Events",
    description: "Terminal can report focus-in and focus-out transitions.",
  },
  alternateScreen: {
    label: "Alternate Screen",
    description: "Terminal can enter a full-screen app buffer.",
  },
  cursorShape: {
    label: "Cursor Shape",
    description: "Terminal can change cursor style for modes such as insert or normal.",
  },
};

const COLOR_DEPTH_RANK: Record<TerminalColorDepth, number> = {
  none: 0,
  ansi16: 1,
  ansi256: 2,
  truecolor: 3,
};

/** Detects terminal capabilities from environment variables and TTY status. */
export function detectTerminalCapabilities(
  options: TerminalCapabilityDetectionOptions = {},
): TerminalCapabilities {
  const env = createEnvReader(options.env);
  const term = env("TERM") ?? "";
  const termProgram = env("TERM_PROGRAM") ?? "";
  const colorTerm = env("COLORTERM") ?? "";
  const isTty = options.isTty ?? safeIsTerminal();
  const noColor = options.noColor ?? Boolean(env("NO_COLOR"));
  const forceColor = options.forceColor ?? env("FORCE_COLOR");
  const interactive = isTty && !isDumbTerminal(term);
  const colorDepth = detectColorDepth({ term, colorTerm, noColor, forceColor, interactive });
  const unicode = interactive && supportsUnicode(env, options.platform);
  const modern = isModernTerminal(term, termProgram, env);

  return {
    interactive,
    colorDepth,
    unicode,
    hyperlinks: interactive && supportsHyperlinks(term, termProgram, env),
    mouse: interactive && !isLinuxConsole(term),
    sgrMouse: interactive && modern,
    bracketedPaste: interactive && modern,
    focusEvents: interactive && modern,
    alternateScreen: interactive,
    cursorShape: interactive && modern,
  };
}

/** Converts raw terminal capability booleans into labeled display entries. */
export function terminalCapabilityEntries(capabilities: TerminalCapabilities): TerminalCapabilityEntry[] {
  return (Object.keys(TERMINAL_CAPABILITY_METADATA) as TerminalCapabilityId[]).map((id) => ({
    id,
    ...TERMINAL_CAPABILITY_METADATA[id],
    available: capabilities[id],
  }));
}

/** Summarizes terminal capability availability counts and color depth. */
export function summarizeTerminalCapabilities(
  capabilities: TerminalCapabilities = detectTerminalCapabilities(),
): TerminalCapabilitySummary {
  const entries = terminalCapabilityEntries(capabilities);
  const available = entries.filter((entry) => entry.available).length;
  return {
    total: entries.length,
    available,
    missing: entries.length - available,
    colorDepth: capabilities.colorDepth,
    entries,
  };
}

/** Formats terminal capabilities as concise CLI/status text. */
export function formatTerminalCapabilities(
  capabilities: TerminalCapabilities = detectTerminalCapabilities(),
): string {
  const summary = summarizeTerminalCapabilities(capabilities);
  const rows = summary.entries.map((entry) => `${entry.available ? "ok" : "missing"} ${entry.label}`);
  return [
    `Terminal capabilities: ${summary.available}/${summary.total} available, ${summary.colorDepth} color`,
    ...rows,
  ].join("\n");
}

/** Builds a deterministic terminal behavior plan from capabilities and app preferences. */
export function createTerminalPlan(
  capabilities: TerminalCapabilities = detectTerminalCapabilities(),
  options: TerminalPlanOptions = {},
): TerminalPlan {
  const reasons: string[] = [];
  const minimumColorDepth = options.minimumColorDepth ?? "ansi16";
  const colorDepth = chooseColorDepth(capabilities.colorDepth, minimumColorDepth);
  if (colorDepth !== capabilities.colorDepth) {
    reasons.push(`Color output was reduced to ${colorDepth} to satisfy the configured minimum.`);
  } else {
    reasons.push(`Using ${colorDepth} color output from terminal detection.`);
  }

  const textMode = (options.preferUnicode ?? true) && capabilities.unicode ? "unicode" : "ascii";
  reasons.push(
    textMode === "unicode"
      ? "Unicode output is available and preferred."
      : "ASCII output selected because Unicode is unavailable or disabled.",
  );

  const mouseProtocol = selectMouseProtocol(capabilities, options.preferMouse ?? true);
  reasons.push(
    mouseProtocol === "none"
      ? "Mouse input disabled because it is unavailable or not preferred."
      : `Mouse input should use the ${mouseProtocol} protocol.`,
  );

  const alternateScreen = Boolean((options.preferAlternateScreen ?? true) && capabilities.alternateScreen);
  const bracketedPaste = Boolean((options.preferBracketedPaste ?? true) && capabilities.bracketedPaste);
  const focusEvents = Boolean((options.preferFocusEvents ?? true) && capabilities.focusEvents);
  const hyperlinks = Boolean((options.preferHyperlinks ?? true) && capabilities.hyperlinks);

  return {
    capabilities,
    colorDepth,
    textMode,
    mouseProtocol,
    alternateScreen,
    bracketedPaste,
    focusEvents,
    hyperlinks,
    cursorShape: capabilities.cursorShape,
    reasons,
  };
}

/** Formats a terminal behavior plan as concise CLI/status text. */
export function formatTerminalPlan(plan: TerminalPlan): string {
  return [
    "Terminal plan:",
    `color    ${plan.colorDepth}`,
    `text     ${plan.textMode}`,
    `mouse    ${plan.mouseProtocol}`,
    `screen   ${plan.alternateScreen ? "alternate" : "inline"}`,
    `paste    ${plan.bracketedPaste ? "bracketed" : "plain"}`,
    `focus    ${plan.focusEvents ? "events" : "plain"}`,
    `links    ${plan.hyperlinks ? "osc8" : "plain"}`,
  ].join("\n");
}

function createEnvReader(
  env: TerminalCapabilityDetectionOptions["env"],
): (name: string) => string | undefined {
  if (typeof env === "function") return env;
  if (env) return (name) => env[name];
  return (name) => {
    try {
      return Deno.env.get(name);
    } catch {
      return undefined;
    }
  };
}

function safeIsTerminal(): boolean {
  try {
    return Deno.stdout.isTerminal();
  } catch {
    return false;
  }
}

function detectColorDepth(options: {
  term: string;
  colorTerm: string;
  noColor: boolean;
  forceColor: boolean | string | undefined;
  interactive: boolean;
}): TerminalColorDepth {
  if (!options.interactive && !options.forceColor) return "none";
  if (options.noColor && !options.forceColor) return "none";
  if (options.forceColor === "0" || options.forceColor === "false") return "none";
  if (options.forceColor === "3" || options.forceColor === "truecolor") return "truecolor";
  if (options.forceColor === "2" || options.forceColor === "256") return "ansi256";
  if (options.forceColor) return "ansi16";
  if (/truecolor|24bit/i.test(options.colorTerm)) return "truecolor";
  if (/-256(color)?$/i.test(options.term) || /256color/i.test(options.term)) return "ansi256";
  return options.interactive ? "ansi16" : "none";
}

function supportsUnicode(env: (name: string) => string | undefined, platform: string = Deno.build.os): boolean {
  if (platform === "windows") {
    return Boolean(env("WT_SESSION") || env("TERMINAL_EMULATOR") || env("TERM_PROGRAM"));
  }
  const locale = [env("LC_ALL"), env("LC_CTYPE"), env("LANG")].filter(Boolean).join(" ");
  return /utf-?8/i.test(locale);
}

function supportsHyperlinks(
  term: string,
  termProgram: string,
  env: (name: string) => string | undefined,
): boolean {
  if (env("DOMTERM")) return true;
  if (env("WT_SESSION")) return true;
  if (/iTerm\.app|WezTerm|vscode|Hyper/i.test(termProgram)) return true;
  return /xterm-kitty|wezterm|foot|alacritty/i.test(term);
}

function isModernTerminal(
  term: string,
  termProgram: string,
  env: (name: string) => string | undefined,
): boolean {
  if (env("WT_SESSION") || env("VTE_VERSION")) return true;
  if (/iTerm\.app|Apple_Terminal|WezTerm|vscode|Hyper/i.test(termProgram)) return true;
  return /xterm|screen|tmux|rxvt|kitty|wezterm|alacritty|foot/i.test(term);
}

function isDumbTerminal(term: string): boolean {
  return term === "" || term === "dumb";
}

function isLinuxConsole(term: string): boolean {
  return /^linux$/i.test(term);
}

function chooseColorDepth(
  detected: TerminalColorDepth,
  minimum: TerminalColorDepth,
): TerminalColorDepth {
  return COLOR_DEPTH_RANK[detected] >= COLOR_DEPTH_RANK[minimum] ? detected : "none";
}

function selectMouseProtocol(
  capabilities: TerminalCapabilities,
  preferMouse: boolean,
): TerminalMouseProtocol {
  if (!preferMouse || !capabilities.mouse) return "none";
  if (capabilities.sgrMouse) return "sgr";
  return "vt200";
}
