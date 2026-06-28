import {
  createAnsiStyle,
  createThemeEnginePipeline,
  createThemeProvider,
  createThemeRegistry,
  createThemeWorkspace,
} from "../mod.ts";

const provider = createThemeProvider({
  registry: createThemeRegistry([
    {
      id: "ops",
      label: "Operations",
      palette: "terminal",
      options: {
        components: {
          Button: {
            base: { base: "foreground", focused: "accent" },
            variants: { danger: { active: "danger" } },
          },
          StatusBar: {
            base: { base: "muted", active: "success" },
          },
        },
      },
    },
  ]),
  activeId: "ops",
});

const accessibility = createThemeEnginePipeline({
  id: "accessibility",
  label: "Accessibility",
  steps: [
    {
      id: "high-contrast",
      options: {
        tokens: {
          accent: createAnsiStyle({ foreground: "brightCyan", bold: true }),
        },
      },
    },
    {
      id: "focus-underline",
      options: {
        components: {
          Button: {
            base: { focused: ["accent", createAnsiStyle({ underline: true })] },
          },
        },
      },
    },
  ],
});

const workspace = createThemeWorkspace({
  provider,
  factories: [
    {
      id: "presentation",
      label: "Presentation",
      palette: "neon",
      tags: ["demo", "high-contrast"],
      priority: 10,
      options: {
        components: {
          Card: {
            base: { base: "surface", focused: "accent" },
          },
        },
      },
    },
  ],
  pipelines: accessibility,
});

console.log("Theme workspace demo");
console.log(`Active provider: ${workspace.provider.activeId.peek()}`);
console.log(`Pipelines: ${workspace.pipelineIds().join(", ")}`);

const active = workspace.activeEngine();
console.log(`Active button: ${active.component("Button").focused("Launch")}`);

const presentation = workspace.factoryEngine("presentation");
console.log(`Factory card: ${presentation.component("Card").focused("Preview")}`);

const warmed = await workspace.prewarm({
  includeActiveProvider: true,
  factoryOverrides: {
    components: {
      Card: {
        variants: { compact: { active: "success" } },
      },
    },
  },
});

console.log("");
console.log(
  `Prewarmed: ${warmed.factories.length} factories, ${warmed.pipelines.length} pipelines, scheduler idle=${warmed.scheduler.idle}`,
);
console.log(`Factory variants: ${warmed.factories[0].engine.variants("Card").join(", ")}`);
console.log(`Active components: ${warmed.activeProvider?.componentNames().join(", ")}`);

console.log("");
console.log(JSON.stringify(workspace.inspect({ tag: "demo" }).factories.inspection, null, 2));
