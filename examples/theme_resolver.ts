import {
  componentThemeStyleRequests,
  createAnsiStyle,
  createThemeProvider,
  createThemeProviderResolver,
  createThemeRegistry,
  formatThemeResolutionMarkdown,
} from "../mod.ts";

const registry = createThemeRegistry([
  {
    id: "ops",
    label: "Ops",
    palette: "terminal",
    options: {
      tokens: {
        accent: createAnsiStyle({ foreground: "brightCyan", bold: true }),
      },
      components: {
        Button: {
          base: { base: "foreground", focused: "accent" },
          variants: { danger: { active: "danger" } },
        },
        StatusBar: {
          base: { active: "accent" },
        },
      },
    },
  },
  {
    id: "neon",
    label: "Neon",
    palette: "neon",
    options: {
      components: {
        Button: {
          base: { focused: "accent" },
        },
      },
    },
  },
]);

const provider = createThemeProvider({ registry, activeId: "ops" });
const resolver = createThemeProviderResolver(provider);
const styles = componentThemeStyleRequests(["Button", "StatusBar"], {
  states: ["base", "focused", "active"],
  variants: (component) => component === "Button" ? ["default", "danger"] : ["default"],
});

console.log("Theme resolver demo");
console.log(formatThemeResolutionMarkdown(resolver, {
  title: "Ops Theme",
  sample: "OK",
  tokens: ["foreground", "accent", "danger"],
  styles,
}));

provider.setTheme("neon");
await Promise.resolve();

console.log("");
console.log("After provider switch:");
console.log(resolver.resolve("Button", "focused")("OK"));
console.log(JSON.stringify(resolver.inspect(), null, 2));

resolver.dispose();
