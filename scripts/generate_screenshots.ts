interface TerminalScreenshot {
  filename: string;
  title: string;
  width: number;
  height: number;
  lines: string[];
  theme?: ScreenshotTheme;
}

const SCREENSHOT_WIDTH = 1960;
const SCREENSHOT_HEIGHT = 1240;

type ScreenshotTheme = "neon" | "exodus" | "system" | "gallery" | "theme" | "docs";
type SegmentKind =
  | "plain"
  | "muted"
  | "border"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "pink"
  | "blue"
  | "green"
  | "heat"
  | "surface";

interface TextSegment {
  text: string;
  kind: SegmentKind;
}

const screenshots: TerminalScreenshot[] = [
  {
    filename: "showcase.svg",
    title: "Showcase",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "neon",
    lines: [
      "┌─ DENOTUI SHOWCASE ───────────────────────────────────────────────────────────┐",
      "│ Widgets     Theme: neon      Route: /overview      Renderer: webgpu-three   │",
      "├───────────────┬─────────────────────────────┬──────────────────────────────┤",
      "│ Command       │ Component Catalog           │ Three ASCII Studio           │",
      "│ Palette       │ 42 widgets / 8 categories   │      ▓▓▓▓▒▒░░                │",
      "│ > theme       │ [x] Button       keyboard   │   ░▒▓██████▓▒░              │",
      "│   renderer    │ [x] DataTable    async      │  ▒██╲╱╲╱╲╱██▒              │",
      "│   route       │ [x] Tree         selection  │  ▓█╱╲╱╲╱╲╱█▓              │",
      "│               │ [x] ToastStack   feedback   │   ░▒▓████▓▒░                │",
      "├───────────────┴──────────────┬──────────────┴──────────────────────────────┤",
      "│ Metrics                       │ Toasts / Focus / Keymap                    │",
      "│ CPU   ███████████░ 72%        │ ✓ command registry synced                  │",
      "│ MEM   ███████░░░░░ 48%        │ ✓ focus scope active                       │",
      "│ NET   ▁▂▃▅▇▆▄▂▁▃▆▇           │ ✓ plugin lifecycle clean                   │",
      "└───────────────────────────────┴─────────────────────────────────────────────┘",
    ],
  },
  {
    filename: "neon-exodus.svg",
    title: "Neon Exodus Suite",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "exodus",
    lines: [
      "NEON EXODUS OPENTUI SUITE / ALL / 07:08:12",
      "[1 ALL]   2 OVERVIEW   3 SIGNALS   4 CONTROL   5 THREE",
      "ARROWS MOVE  ENTER,F MAX  B/G/M ASCII  O/W/E SUITE  Q EXIT",
      "",
      "┌─ OPENTUI DEMO DECK ───────────────────────── 24 DEMOS / 6 THREE.JS SCENES ┐",
      "│ SELECTED WARNING STACK / VIEW ALL / SOURCE OPENTUI                         │",
      "│ OVERVIEW 6  SIGNALS 6  CONTROL 6  THREE 6                                  │",
      "│ OPEN TUI PARITY: 24 DEMOS / WEB ORDERING: 24 DEMOS / EXTENDED: 25 DEMOS    │",
      "└─────────────────────────────────────────────────────────────────────────────┘",
      "┌─ SELECTED / ALERT-000 / WARNING STACK ─┐ ┌─ OVERVIEW / TIME-SEG / COUNTER ┐",
      "│ WARN  59% ALERT-000                    │ │ CLOCK 14:08:36                 │",
      "│ HARMONIC  37% ALERT-000                │ │ COUNTDOWN 07:08:12             │",
      "│ NOISE  88% ALERT-000                   │ │ SYNC 91.4%                     │",
      "└────────────────────────────────────────┘ └────────────────────────────────┘",
      "┌─ THREE-5 / WIREFRAME LATTICE ──────────┐ ┌─ THREE-6 / A.T.FIELD RING ─────┐",
      "│ Acerola ASCII: mixed glyph/block mode  │ │ WebGPU three.js backend ready   │",
      "│        ░▒▓██╲╱╲╱██▓▒░                 │ │     ◎──◎──◎   violet spine     │",
      "└────────────────────────────────────────┘ └────────────────────────────────┘",
    ],
  },
  {
    filename: "neon-exodus-focus.svg",
    title: "Neon Exodus Focus Mode",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "exodus",
    lines: [
      "NEON EXODUS OPENTUI SUITE / THREE / 07:03:44",
      "ARROWS CYCLE  ESC,T RETURN  +/- VOL  B/G/M ASCII  O/W/E SUITE  Q EXIT",
      "",
      "┌─ SELECTED / THREE-5 / WIREFRAME LATTICE CHAMBER ───────────────────────────┐",
      "│ LATTICE / MAXIMIZED / SOURCE OPENTUI / ACEROLA WEBGPU READY / STYLE MIXED  │",
      "│                                                                            │",
      "│                          ░░░░▒▒▓▓████▓▓▒▒░░░░                              │",
      "│                    ░▒▓██╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱██▓▒░                             │",
      "│               ░▒▓██╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱██▓▒░                            │",
      "│            ░▒▓█╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱█▓▒░                             │",
      "│               ░▒▓██╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱██▓▒░                             │",
      "│                    ░▒▓██╱╲╱╲╱╲╱╲╱╲╱╲╱██▓▒░                                │",
      "│                          ░░░░▒▒▓▓████▓▓▒▒░░░░                              │",
      "│                                                                            │",
      "│ depth 0.82   twist +0.41   lift -0.16   pulse 0.91   glyph mix auto-match  │",
      "└────────────────────────────────────────────────────────────────────────────┘",
    ],
  },
  {
    filename: "neon-exodus-web.svg",
    title: "Neon Exodus Web Ordering",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "exodus",
    lines: [
      "NEON EXODUS WEB SUITE / SIGNALS / 06:58:09",
      "[1 ALL]   2 OVERVIEW   [3 SIGNALS]   4 CONTROL   5 THREE",
      "WEB ORDERING MODE / DENSE DEMO WALL / POINTER SIGNALS SIMULATED",
      "",
      "┌─ TELEMETRY RACK ──────────────┐ ┌─ BIOSIGNAL STRIP ───────────────────────┐",
      "│ LIFE-SUPPORT / async meters   │ │ WAVE-85 / drifting traces               │",
      "│ █▆▅▂▁▃▇█▆▃▂▂▅█▇▅▁▂▅█         │ │ ───●●●────•••────◦◦◦────●●──────       │",
      "│ ▄▇█▅▃▁▂▆█▇▄▂▁▃▆█▅▂▁▃         │ │   ●   ●  •   •  ◦   ◦  ●  ●            │",
      "└───────────────────────────────┘ └────────────────────────────────────────┘",
      "┌─ HARMONIC GRAPH ──────────────┐ ┌─ PSYCHOGRAPH DISPLAY ──────────────────┐",
      "│ SIM-GRAPH A+ / interference   │ │ PHASE-4 / behavior scribble            │",
      "│    ╳╳╳╳╳╳╳╳╳                  │ │ ╳╳╳──╳╳────╳╳╳╳──────╳╳╳              │",
      "│ ╳╳╳     •••••••    ╳╳╳        │ │    ╳╳    ╳╳      ╳╳╳╳    ╳╳           │",
      "└───────────────────────────────┘ └────────────────────────────────────────┘",
      "┌─ FIELD RING CAPTURE ──────────┐ ┌─ HEX HEATMAP ──────────────────────────┐",
      "│       ◌◌◌◎◎◎●◆●◎◎◎◌◌◌        │ │ ░▒▓█▓▒░░▒▓██▓▒░░▒▓█▓▒░                │",
      "└───────────────────────────────┘ └────────────────────────────────────────┘",
    ],
  },
  {
    filename: "neon-exodus-studio.svg",
    title: "Neon Exodus Acerola Studio",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "exodus",
    lines: [
      "NEON EXODUS EXTENDED SUITE / THREE / 06:52:27",
      "EXTENDED MODE / THREE-ASCII-STUDIO / BLOCKS GLYPHS MIXED",
      "",
      "┌─ SELECTED / ASCII-GPU / ACEROLA ASCII STUDIO ──────────────────────────────┐",
      "│ torus knot + sphere + cube + floor / post-process edge-fill-depth pipeline │",
      "│                                                                            │",
      "│              ▓▓▓▓██████▓▓▒▒░░                         ░░▒▒▓▓              │",
      "│          ░▒▓████▓▒░░░░▒▓████▓▒░                  ░▒▓████████▓▒░           │",
      "│        ░▓██▓▒░              ░▒▓██░              ░▓██▓▒░  ░▒▓██▓░          │",
      "│       ▒██▒       torus knot       ▒██▒          ▒██▒   sphere   ▒██▒       │",
      "│        ░▓██▓▒░              ░▒▓██░              ░▓██▓▒░  ░▒▓██▓░          │",
      "│          ░▒▓████▓▒░░░░▒▓████▓▒░                  ░▒▓████████▓▒░           │",
      "│                   ░░▒▒▓▓████▓▓▒▒░░                    ░░▒▒▓▓              │",
      "│                              ╱╲╱╲╱╲   cube   ╱╲╱╲╱╲                         │",
      "│          floor ░░░░▒▒▒▒▓▓▓▓████████████▓▓▓▓▒▒▒▒░░░░                       │",
      "│ renderer mixed-best / edge bias 1.35 / blend 0.80 / WebGPU preferred      │",
      "└────────────────────────────────────────────────────────────────────────────┘",
    ],
  },
  {
    filename: "system-monitor.svg",
    title: "System Monitor",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "system",
    lines: [
      "┌─ SYSTEM MONITOR ───────────────────────────── F4 options ─ F9 layout ───────┐",
      "│ host deno-lab        runtime balanced        ascii mixed        60 fps       │",
      "├────────────────────────────┬────────────────────────────┬──────────────────┤",
      "│ CPU PRESSURE               │ MEMORY                     │ PROCESS TABLE    │",
      "│ cores 16                   │ used 18.6G / 64G           │ PID   CPU  RSS   │",
      "│ ████████████░░░░ 71%       │ ███████░░░░░░░ 29%         │ 1842  32%  1.2G  │",
      "│ ▁▃▄▆▇█▆▅▃▂▃▅▇▆▂           │ cache 8.2G                 │ 1910  14%  728M  │",
      "├────────────────────────────┴────────────────────────────┴──────────────────┤",
      "│ THREE ASCII: solenoid                                                       │",
      "│               ░░▒▒▓▓████▓▓▒▒░░                                              │",
      "│          ░▒▓██╲╱╲╱╲╱╲╱╲╱██▓▒░                                             │",
      "│       ░▒▓█╲╱╲╱╲╱╲╱╲╱╲╱╲╱█▓▒░                                             │",
      "│          ░▒▓██╱╲╱╲╱╲╱╲╱██▓▒░                                             │",
      "│               ░░▒▒▓▓████▓▓▒▒░░                                              │",
      "└──────────────────────────────────────────────────────────────────────────────┘",
    ],
  },
  {
    filename: "theme-gallery.svg",
    title: "Theme Gallery",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "theme",
    lines: [
      "THEME GALLERY / active=grwizard-velvet / query=(none) / 6 selectable packs",
      "select with: deno task theme-gallery -- --select grwizard-forge",
      "",
      "┌─ GRWIZARD PALETTES ─────────────────────────────────────────────────────────┐",
      "│   grwizard-arcane      Arcane Tide        cyan glass + brass highlights     │",
      "│   grwizard-forge       Forge Ember        ember copper + furnace gold       │",
      "│   grwizard-grove       Verdant Grove      pine shadows + mint accents       │",
      "│ > grwizard-velvet      Royal Velvet       plum lacquer + rose neon          │",
      "│   grwizard-parchment   Parchment Brass    ivory panels + ink + red wax      │",
      "│   grwizard-seaglass    Seaglass Ledger    teal framing + slate typography   │",
      "└────────────────────────────────────────────────────────────────────────────┘",
      "┌─ LIVE PREVIEW ────────────────────────┬─ COMPONENT STATES ─────────────────┐",
      "│ foreground LIVE  muted LIVE           │ Button/focused      LIVE           │",
      "│ accent     LIVE  success LIVE         │ StatusBar/warning   LIVE           │",
      "│ warning    LIVE  danger  LIVE         │ Badge/review        LIVE           │",
      "│ surface    LIVE  layer focus-rings    │ DataTable/selected  LIVE           │",
      "└───────────────────────────────────────┴────────────────────────────────────┘",
      "valid=true  active layers=focus-rings  coverage=8 components / 20 variants",
    ],
  },
  {
    filename: "demo-gallery.svg",
    title: "Demo Gallery",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "gallery",
    lines: [
      "# Demo Gallery",
      "",
      "Launch targets: 34 across app, check, demo, report, tool",
      "Components: 36 across data, feedback, input, layout, navigation, overlay, primitive, visualization",
      "Renderer backends: 2/3 available       Runtime capabilities: 2/5",
      "Theme packs: 3, layers: 0              Plugin packs: shell, visualization, data",
      "",
      "Terminal plan:",
      "color    truecolor",
      "text     unicode",
      "mouse    sgr",
      "screen   alternate",
      "",
      "Recommended tour:",
      "1. ./visualization showcase      full widget wall",
      "2. ./visualization neon         OpenTUI/web Neon Exodus suite",
      "3. ./visualization form         forms, commands, and signal bindings",
      "4. ./visualization table        data table and selection commands",
    ],
  },
  {
    filename: "api-reference.svg",
    title: "API Reference",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    theme: "docs",
    lines: [
      "# API Reference",
      "",
      "Entrypoint: mod.ts",
      "Modules: 175",
      "Re-export declarations: 174",
      "Exported symbols: 1320",
      "Documented symbols: 332",
      "Duplicate symbols: 0",
      "Missing targets: 0",
      "",
      "Module index:",
      "src/app/actions.ts                  7 symbols    7 documented",
      "src/app/app.ts                     13 symbols   13 documented",
      "src/components/catalog.ts          16 symbols   16 documented",
      "src/runtime/terminal_session.ts     7 symbols    7 documented",
      "src/three_ascii/renderer.ts         2 symbols    0 documented",
    ],
  },
];

if (import.meta.main) {
  await Deno.mkdir("docs/screenshots", { recursive: true });
  const paths: string[] = [];
  for (const screenshot of screenshots) {
    const path = `docs/screenshots/${screenshot.filename}`;
    await Deno.writeTextFile(path, renderSvg(screenshot));
    paths.push(path);
  }
  await formatScreenshots(paths);
}

function renderSvg(screenshot: TerminalScreenshot): string {
  const padding = 56;
  const titleHeight = 88;
  const lineHeight = 52;
  const contentTop = padding + titleHeight;
  const contentHeight = screenshot.height - padding * 2 - titleHeight;
  const theme = screenshot.theme ?? "neon";
  const text = screenshot.lines.map((line, index) =>
    renderLine(line, padding + 44, contentTop + 68 + index * lineHeight)
  ).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${screenshot.width}" height="${screenshot.height}" viewBox="0 0 ${screenshot.width} ${screenshot.height}" class="theme-${theme}" role="img" aria-label="${
      escapeXml(screenshot.title)
    } terminal screenshot">`,
    "<style>",
    "svg{background:#06080d}.frame{fill:#0d1117;stroke:var(--border);stroke-width:4}.title{fill:#f8fafc;font:700 36px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.term{fill:#dbeafe;font:32px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.bar{fill:#111827;stroke:#374151}.screen{fill:#090d14;opacity:.91}.glow{filter:drop-shadow(0 0 18px var(--glow))}.plain{fill:var(--fg)}.muted{fill:var(--muted)}.border{fill:var(--border)}.accent{fill:var(--accent)}.success{fill:var(--success)}.warning{fill:var(--warning)}.danger{fill:var(--danger)}.violet{fill:var(--violet)}.pink{fill:var(--pink)}.blue{fill:var(--blue)}.green{fill:var(--green)}.heat{fill:var(--heat)}.surface{fill:var(--surface)}.theme-neon{--fg:#d7fff7;--muted:#77909a;--border:#2dd4bf;--accent:#67e8f9;--success:#a3e635;--warning:#facc15;--danger:#fb7185;--violet:#c084fc;--pink:#f472b6;--blue:#60a5fa;--green:#34d399;--heat:#f97316;--surface:#93c5fd;--glow:#2dd4bf}.theme-exodus{--fg:#f7e8ff;--muted:#9478a8;--border:#a855f7;--accent:#22d3ee;--success:#bef264;--warning:#fbbf24;--danger:#ff4fd8;--violet:#c084fc;--pink:#fb7185;--blue:#38bdf8;--green:#4ade80;--heat:#f97316;--surface:#e879f9;--glow:#ff4fd8}.theme-system{--fg:#dbeafe;--muted:#94a3b8;--border:#38bdf8;--accent:#67e8f9;--success:#22c55e;--warning:#f59e0b;--danger:#ef4444;--violet:#a78bfa;--pink:#f472b6;--blue:#3b82f6;--green:#10b981;--heat:#f97316;--surface:#93c5fd;--glow:#38bdf8}.theme-gallery{--fg:#f8fafc;--muted:#94a3b8;--border:#818cf8;--accent:#f472b6;--success:#34d399;--warning:#fbbf24;--danger:#fb7185;--violet:#c084fc;--pink:#f472b6;--blue:#60a5fa;--green:#4ade80;--heat:#fb923c;--surface:#a5b4fc;--glow:#818cf8}.theme-theme{--fg:#f7effa;--muted:#b8a6c4;--border:#ac7cc8;--accent:#f694d8;--success:#aad68c;--warning:#ffd08b;--danger:#f27d96;--violet:#c084fc;--pink:#f694d8;--blue:#9db7ff;--green:#7be0bb;--heat:#ff9f68;--surface:#ddd0e6;--glow:#f694d8}.theme-docs{--fg:#e5e7eb;--muted:#9ca3af;--border:#64748b;--accent:#93c5fd;--success:#86efac;--warning:#fde68a;--danger:#fca5a5;--violet:#c4b5fd;--pink:#f9a8d4;--blue:#93c5fd;--green:#86efac;--heat:#fdba74;--surface:#cbd5e1;--glow:#93c5fd}",
    "</style>",
    `<rect x="${padding}" y="${padding}" width="${screenshot.width - padding * 2}" height="${
      screenshot.height - padding * 2
    }" rx="24" class="frame glow"/>`,
    `<rect x="${padding}" y="${padding}" width="${
      screenshot.width - padding * 2
    }" height="${titleHeight}" rx="24" class="bar"/>`,
    `<text x="${padding + 44}" y="${padding + 58}" class="title">${escapeXml(screenshot.title)}</text>`,
    `<circle cx="${screenshot.width - padding - 144}" cy="${padding + 44}" r="12" fill="var(--success)"/>`,
    `<circle cx="${screenshot.width - padding - 96}" cy="${padding + 44}" r="12" fill="#facc15"/>`,
    `<circle cx="${screenshot.width - padding - 48}" cy="${padding + 44}" r="12" fill="#fb7185"/>`,
    `<rect x="${padding + 24}" y="${contentTop}" width="${screenshot.width - padding * 2 - 48}" height="${
      contentHeight - 24
    }" rx="16" class="screen"/>`,
    text,
    "</svg>",
    "",
  ].join("\n");
}

function renderLine(line: string, x: number, y: number): string {
  const segments = colorizeLine(line);
  const tspans = segments.map((segment) => `<tspan class="${segment.kind}">${escapeSvgText(segment.text)}</tspan>`)
    .join(
      "",
    );
  return `<text x="${x}" y="${y}" class="term" xml:space="preserve">${tspans}</text>`;
}

function colorizeLine(line: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern =
    /(grwizard-[a-z]+|Arcane Tide|Forge Ember|Verdant Grove|Royal Velvet|Parchment Brass|Seaglass Ledger|WARN|WARNING|ALERT|danger|Danger|failed|FAILED|error|ERROR|success|SUCCESS|ok|✓|active|selected|SELECTED|LIVE|WebGPU|Acerola|ASCII|THREE|theme|Theme|neon|Neon|CPU|MEM|NET|Renderer|runtime|Runtime|valid=true|coverage|[0-9]+(?:\.[0-9]+)?%|[0-9]+\/[0-9]+|[┌┐└┘├┤┬┴┼─│╲╱]+|[█▓▒░▁▂▃▄▅▆▇]+|[◎●◆◌•╳]+)/g;
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ text: line.slice(cursor, index), kind: "plain" });
    }
    const text = match[0];
    segments.push({ text, kind: classifySegment(text) });
    cursor = index + text.length;
  }
  if (cursor < line.length) {
    segments.push({ text: line.slice(cursor), kind: "plain" });
  }
  return mergeSegments(segments);
}

function classifySegment(text: string): SegmentKind {
  if (/^[┌┐└┘├┤┬┴┼─│╲╱]+$/.test(text)) return "border";
  if (/^[█▓▒░▁▂▃▄▅▆▇]+$/.test(text)) return "heat";
  if (/^[◎●◆◌•╳]+$/.test(text)) return "violet";
  if (/WARN|WARNING|ALERT|danger|Danger|failed|FAILED|error|ERROR/.test(text)) return "danger";
  if (/success|SUCCESS|ok|✓|valid=true/.test(text)) return "success";
  if (/active|selected|SELECTED|LIVE|coverage/.test(text)) return "warning";
  if (/WebGPU|Acerola|ASCII|THREE|Renderer|runtime|Runtime|CPU|MEM|NET/.test(text)) return "accent";
  if (/theme|Theme|neon|Neon/.test(text)) return "pink";
  if (/grwizard-|Arcane Tide|Forge Ember|Verdant Grove|Royal Velvet|Parchment Brass|Seaglass Ledger/.test(text)) {
    return "violet";
  }
  if (/^[0-9]+/.test(text)) return "blue";
  return "plain";
}

function mergeSegments(segments: readonly TextSegment[]): TextSegment[] {
  const merged: TextSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous?.kind === segment.kind) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeSvgText(value: string): string {
  return escapeXml(value).replaceAll(" ", "&#160;");
}

async function formatScreenshots(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const result = await new Deno.Command("deno", { args: ["fmt", ...paths] }).output();
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr).trim() || "failed to format screenshots");
  }
}
