import {
  bindThemeEngineCommands,
  CommandRegistry,
  createCommandSurface,
  createThemeEnginePipeline,
  createThemeWorkspace,
  type ThemeEngineCommandAction,
} from "../mod.ts";

const workspace = createThemeWorkspace({
  factories: [
    {
      id: "ops-neon",
      label: "Ops Neon",
      description: "Operational dashboard theme with dense component coverage.",
      palette: "neon",
      tags: ["dashboard", "dark"],
      priority: 20,
      options: {
        components: {
          Badge: {
            base: { base: "foreground", active: "success" },
          },
          Panel: {
            base: { base: "surface", focused: "accent" },
          },
        },
      },
    },
    {
      id: "console",
      label: "Field Console",
      palette: "terminal",
      tags: ["remote", "portable"],
      priority: 10,
      options: {
        components: {
          Input: {
            base: { focused: "accent" },
          },
        },
      },
    },
    {
      id: "draft",
      label: "Draft Broken Pack",
      description: "Invalid pack included to show disabled command projection.",
      options: {
        components: {
          Badge: {
            base: { base: "missing-token" as "accent" },
          },
        },
      },
    },
  ],
  pipelines: createThemeEnginePipeline({
    id: "runtime-accessibility",
    steps: [
      {
        id: "strong-focus",
        label: "Strong Focus",
        options: {
          components: {
            Badge: {
              variants: {
                runtime: { active: "accent" },
              },
            },
          },
        },
      },
    ],
  }),
});

const registry = new CommandRegistry<ThemeEngineCommandAction>();
const dispose = bindThemeEngineCommands(registry, workspace, {
  title: "Workspace Theme Engines",
});
const surface = createCommandSurface(registry);
const actions: ThemeEngineCommandAction[] = [];

console.log("Theme engine command demo");
console.log("Command surface:");
for (const item of surface.items.value) {
  console.log(`- ${item.disabled ? "[disabled] " : ""}${item.id}: ${item.label}`);
}

await registry.execute("theme.engine.preview.ops-neon", (action) => void actions.push(action));
await registry.execute("theme.engine.catalog", (action) => void actions.push(action));

const preview = actions.find((action) => action.type === "theme.engine.previewed");
if (preview?.type === "theme.engine.previewed" && preview.payload) {
  console.log("");
  console.log(`Previewed: ${preview.payload.inspection.label}`);
  console.log(`Components: ${preview.payload.engine.components.map((component) => component.name).join(", ")}`);
  console.log(
    `Badge variants after runtime pipelines: ${workspace.factoryEngine("ops-neon").variants("Badge").join(", ")}`,
  );
}

const catalog = actions.find((action) => action.type === "theme.engine.catalog.reported");
if (catalog?.type === "theme.engine.catalog.reported" && catalog.payload) {
  console.log("");
  console.log(catalog.payload.markdown);
}

dispose();
