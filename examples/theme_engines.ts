import { createAnsiStyle, createThemeEngineFactoryRegistry, prewarmThemeEngines, ThemeEngineFactory } from "../mod.ts";

const underline = createAnsiStyle({ underline: true });

const registry = createThemeEngineFactoryRegistry([
  {
    id: "ops-neon",
    label: "Ops Neon",
    description: "High contrast operational dashboard theme.",
    palette: "neon",
    tags: ["dashboard", "dark"],
    priority: 20,
    options: {
      components: {
        Button: {
          base: { base: "foreground", focused: "accent" },
          variants: {
            danger: { active: "danger" },
            quiet: { base: "muted" },
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
  },
  {
    id: "field-console",
    label: "Field Console",
    description: "Plain terminal-first pack for remote shells.",
    palette: "terminal",
    tags: ["terminal", "remote"],
    priority: 10,
    options: {
      tokens: {
        accent: createAnsiStyle({ foreground: "brightCyan", bold: true }),
      },
      components: {
        Button: {
          base: { focused: "accent" },
        },
        Input: {
          base: { base: "foreground", focused: ["accent", underline] },
        },
      },
    },
  },
]);

console.log("Theme engine factory demo");
for (const factory of registry.inspect()) {
  console.log(
    `- ${factory.id}: palette=${factory.palette} priority=${factory.priority} valid=${factory.valid}`,
  );
  console.log(`  components=${factory.components.join(", ") || "none"}`);
}

const warmed = await registry.prewarm({
  overrides: {
    components: {
      Button: {
        variants: {
          primary: { active: "success" },
        },
      },
    },
  },
});

console.log("");
console.log("Prewarmed engines:");
for (const result of warmed) {
  console.log(`- ${result.id}: ${result.engine.component("Button", "primary").active("OK")}`);
}

const detached = new ThemeEngineFactory({
  id: "detached",
  palette: "plain",
  options: { components: { Badge: { base: { base: "foreground" } } } },
});
const [detachedResult] = await prewarmThemeEngines([detached]);
console.log("");
console.log(`Detached factory: ${detachedResult.id}/${detachedResult.engine.componentNames().join(", ")}`);
