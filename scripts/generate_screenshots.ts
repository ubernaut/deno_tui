interface TerminalScreenshot {
  filename: string;
  title: string;
  width: number;
  height: number;
  lines: string[];
}

const SCREENSHOT_WIDTH = 1960;
const SCREENSHOT_HEIGHT = 1240;

const screenshots: TerminalScreenshot[] = [
  {
    filename: "showcase.svg",
    title: "Showcase",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
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
    filename: "system-monitor.svg",
    title: "System Monitor",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
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
    filename: "demo-gallery.svg",
    title: "Demo Gallery",
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
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
  const text = screenshot.lines.map((line, index) =>
    `<text x="${padding + 44}" y="${contentTop + 68 + index * lineHeight}" class="term">${escapeXml(line)}</text>`
  ).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${screenshot.width}" height="${screenshot.height}" viewBox="0 0 ${screenshot.width} ${screenshot.height}" role="img" aria-label="${
      escapeXml(screenshot.title)
    } terminal screenshot">`,
    "<style>",
    "svg{background:#06080d}.frame{fill:#0d1117;stroke:#2dd4bf;stroke-width:4}.title{fill:#e6edf3;font:700 36px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.term{fill:#c9d1d9;font:32px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.accent{fill:#67e8f9}.bar{fill:#111827;stroke:#374151}",
    "</style>",
    `<rect x="${padding}" y="${padding}" width="${screenshot.width - padding * 2}" height="${
      screenshot.height - padding * 2
    }" rx="24" class="frame"/>`,
    `<rect x="${padding}" y="${padding}" width="${
      screenshot.width - padding * 2
    }" height="${titleHeight}" rx="24" class="bar"/>`,
    `<text x="${padding + 44}" y="${padding + 58}" class="title">${escapeXml(screenshot.title)}</text>`,
    `<circle cx="${screenshot.width - padding - 144}" cy="${padding + 44}" r="12" class="accent"/>`,
    `<circle cx="${screenshot.width - padding - 96}" cy="${padding + 44}" r="12" fill="#facc15"/>`,
    `<circle cx="${screenshot.width - padding - 48}" cy="${padding + 44}" r="12" fill="#fb7185"/>`,
    `<rect x="${padding + 24}" y="${contentTop}" width="${screenshot.width - padding * 2 - 48}" height="${
      contentHeight - 24
    }" rx="16" fill="#090d14" opacity="0.86"/>`,
    text,
    "</svg>",
    "",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function formatScreenshots(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const result = await new Deno.Command("deno", { args: ["fmt", ...paths] }).output();
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr).trim() || "failed to format screenshots");
  }
}
