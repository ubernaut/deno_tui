import {
  createAnsiStyle,
  createThemeEngine,
  createThemeEnginePipeline,
  prewarmThemeEnginePipelines,
  ThemeEngine,
} from "../mod.ts";

const underline = createAnsiStyle({ underline: true });

const runtimePipeline = createThemeEnginePipeline({
  id: "runtime-accessibility",
  label: "Runtime Accessibility",
  description: "Layered theme modifiers for contrast, focus affordance, and brand accents.",
  steps: [
    {
      id: "high-contrast",
      label: "High Contrast",
      options: {
        tokens: {
          accent: createAnsiStyle({ foreground: "brightCyan", bold: true }),
          warning: createAnsiStyle({ foreground: "brightYellow", bold: true }),
        },
        components: {
          Button: {
            base: { focused: "accent" },
            variants: { warning: { active: "warning" } },
          },
        },
      },
    },
    {
      id: "focus-ring",
      label: "Focus Ring",
      transform: (engine) =>
        engine.extend({
          components: {
            Input: {
              base: { focused: ["accent", underline] },
            },
          },
        }),
    },
    {
      id: "compact-density",
      label: "Compact Density",
      enabled: false,
      options: {
        components: {
          StatusBar: {
            base: { active: "accent" },
          },
        },
      },
    },
  ],
});

console.log("Theme pipeline demo");
console.log(JSON.stringify(runtimePipeline.inspect(), null, 2));

const base = createThemeEngine("terminal", {
  components: {
    Button: {
      base: { base: "foreground" },
    },
    Input: {
      base: { base: "foreground" },
    },
  },
});

const engine = runtimePipeline.apply(base);
console.log("");
console.log(`Button focused: ${engine.component("Button").focused("OK")}`);
console.log(`Button warning: ${engine.component("Button", "warning").active("WARN")}`);
console.log(`Input focused: ${engine.component("Input").focused("name")}`);

runtimePipeline.enable("compact-density");
const [warmed] = await prewarmThemeEnginePipelines([runtimePipeline], {
  base: () => new ThemeEngine({ tokens: base.theme.tokens }),
});

console.log("");
console.log(`Prewarmed: ${warmed.id}`);
console.log(`Status active: ${warmed.engine.component("StatusBar").active("ready")}`);
