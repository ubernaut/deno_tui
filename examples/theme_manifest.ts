import {
  compileThemeManifestOptions,
  createThemeEngine,
  createThemeEngineFromManifest,
  createThemeLayerStack,
  createThemeProvider,
  createThemeRegistryFromManifests,
  diffThemeEngines,
  previewThemeProvider,
  validateThemeOptions,
} from "../mod.ts";

const opsManifest = {
  id: "ops",
  label: "Operations",
  palette: "terminal",
  options: {
    tokens: {
      foreground: { foreground: "white" },
      accent: { foreground: [31, 231, 210], bold: true },
      danger: { foreground: "red", underline: true },
      surface: { background: 235 },
    },
    components: {
      Field: {
        base: {
          base: "foreground",
          focused: ["accent", { underline: true }],
        },
      },
      Button: {
        extends: "Field",
        variants: {
          danger: {
            active: ["danger", { bold: true }],
          },
        },
      },
      StatusBar: {
        base: {
          base: ["surface", "foreground"],
          active: ["surface", "accent"],
        },
      },
    },
  },
} as const;

const options = compileThemeManifestOptions(opsManifest.options);
const issues = validateThemeOptions(options);
const registry = createThemeRegistryFromManifests([opsManifest]);
const engine = createThemeEngineFromManifest(opsManifest);
const provider = createThemeProvider({
  registry,
  activeId: "ops",
  layers: createThemeLayerStack([
    {
      id: "alerts",
      label: "Alert state overrides",
      options: {
        components: {
          Button: { variants: { danger: { active: "danger" } } },
        },
      },
    },
  ]),
});
const preview = previewThemeProvider(provider, {
  sample: "LIVE",
  tokens: ["foreground", "accent", "danger"],
  components: ["Button", "StatusBar"],
  states: ["base", "active"],
});
const base = createThemeEngine("terminal");
const diff = diffThemeEngines(base, engine, {
  sample: "DEMO",
  components: ["Button", "StatusBar"],
});

console.log("Theme manifest demo");
console.log(`pack: ${opsManifest.id} (${opsManifest.label})`);
console.log(`validation: ${issues.length === 0 ? "ok" : `${issues.length} issue(s)`}`);
console.log(`registry: ${registry.ids().join(", ")}`);
console.log(`compiled accent: ${options.tokens?.accent?.("accent")}`);
console.log(`button/default/base: ${engine.component("Button").base("button")}`);
console.log(`button/default/focused: ${engine.component("Button").focused("button")}`);
console.log(`button/danger/active: ${engine.component("Button", "danger").active("button")}`);
console.log(`status/active: ${engine.component("StatusBar").active("status")}`);
console.log("");
console.log(`Provider preview: ${preview.activeId} layers=${preview.activeLayers.join(", ") || "none"}`);
for (const entry of preview.tokens) {
  console.log(`- token ${entry.token}: ${entry.preview.styled}`);
}
for (const entry of preview.components) {
  console.log(`- ${entry.component}/${entry.variant}/${entry.state}: ${entry.preview.styled}`);
}
console.log("");
console.log("Changed tokens:");
for (const entry of diff.tokens) {
  console.log(`- ${entry.token}: ${entry.after.styled}`);
}
console.log("");
console.log("Changed component states:");
for (const entry of diff.components) {
  console.log(`- ${entry.component}/${entry.variant}/${entry.state}: ${entry.after.styled}`);
}
