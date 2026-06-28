interface TerminalScreenshot {
  filename: string;
  title: string;
  width: number;
  height: number;
  lines: string[];
}

const screenshots: TerminalScreenshot[] = [
  {
    filename: "showcase.svg",
    title: "Showcase",
    width: 980,
    height: 620,
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
    filename: "system-monitor.svg",
    title: "System Monitor",
    width: 980,
    height: 620,
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
    width: 980,
    height: 620,
    lines: [
      "# Demo Gallery",
      "",
      "Launch targets: 30 across app, check, demo, report, tool",
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
      "2. ./visualization polygons      glyph/block/mixed three.js ASCII",
      "3. ./visualization monitor       live panels and selectable 3D views",
      "4. ./visualization adopter       app/runtime/theme/plugin/data integration",
    ],
  },
  {
    filename: "api-reference.svg",
    title: "API Reference",
    width: 980,
    height: 620,
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
  const padding = 28;
  const titleHeight = 44;
  const lineHeight = 26;
  const contentTop = padding + titleHeight;
  const contentHeight = screenshot.height - padding * 2 - titleHeight;
  const text = screenshot.lines.map((line, index) =>
    `<text x="${padding + 22}" y="${contentTop + 34 + index * lineHeight}" class="term">${escapeXml(line)}</text>`
  ).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${screenshot.width}" height="${screenshot.height}" viewBox="0 0 ${screenshot.width} ${screenshot.height}" role="img" aria-label="${
      escapeXml(screenshot.title)
    } terminal screenshot">`,
    "<style>",
    "svg{background:#06080d}.frame{fill:#0d1117;stroke:#2dd4bf;stroke-width:2}.title{fill:#e6edf3;font:700 18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.term{fill:#c9d1d9;font:16px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.accent{fill:#67e8f9}.bar{fill:#111827;stroke:#374151}",
    "</style>",
    `<rect x="${padding}" y="${padding}" width="${screenshot.width - padding * 2}" height="${
      screenshot.height - padding * 2
    }" rx="12" class="frame"/>`,
    `<rect x="${padding}" y="${padding}" width="${
      screenshot.width - padding * 2
    }" height="${titleHeight}" rx="12" class="bar"/>`,
    `<text x="${padding + 22}" y="${padding + 29}" class="title">${escapeXml(screenshot.title)}</text>`,
    `<circle cx="${screenshot.width - padding - 72}" cy="${padding + 22}" r="6" class="accent"/>`,
    `<circle cx="${screenshot.width - padding - 48}" cy="${padding + 22}" r="6" fill="#facc15"/>`,
    `<circle cx="${screenshot.width - padding - 24}" cy="${padding + 22}" r="6" fill="#fb7185"/>`,
    `<rect x="${padding + 12}" y="${contentTop}" width="${screenshot.width - padding * 2 - 24}" height="${
      contentHeight - 12
    }" rx="8" fill="#090d14" opacity="0.86"/>`,
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
