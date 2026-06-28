import {
  bindComponentThemes,
  createAnsiStyle,
  createThemeProvider,
  createThemeRegistry,
  Signal,
  type Theme,
} from "../mod.ts";

class ThemeProbe {
  readonly samples: string[] = [];

  constructor(readonly id: string) {}

  setTheme(theme: Theme): void {
    this.samples.push(theme.base(this.id));
  }
}

const buttonVariant = new Signal("default");
const primaryButton = new ThemeProbe("primary");
const statusBadge = new ThemeProbe("status");
const replacementButton = new ThemeProbe("replacement");
const provider = createThemeProvider({
  registry: createThemeRegistry([
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
            variants: { danger: { base: "danger" } },
          },
          Badge: {
            base: { base: "accent" },
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
          Button: { base: { base: "foreground", focused: "accent" } },
          Badge: { base: { base: "foreground" } },
        },
      },
    },
  ]),
  activeId: "ops",
});

const bindings = bindComponentThemes(provider, [
  {
    id: "primary-button",
    target: primaryButton,
    componentName: "Button",
    variant: buttonVariant,
  },
  {
    id: "status-badge",
    target: statusBadge,
    componentName: "Badge",
  },
]);

console.log("Theme binding group demo");
console.log(JSON.stringify(bindings.inspect(), null, 2));
console.log("");

buttonVariant.value = "danger";
await Promise.resolve();

provider.setTheme("neon");
await Promise.resolve();

bindings.register({
  id: "primary-button",
  target: replacementButton,
  componentName: "Button",
});
await Promise.resolve();

provider.setTheme("ops");
await Promise.resolve();

console.log("After variant switch, provider switch, and binding replacement:");
console.log(JSON.stringify(bindings.inspect(), null, 2));
console.log("");
console.log(`primary-button samples=${primaryButton.samples.join(" | ")}`);
console.log(`replacement-button samples=${replacementButton.samples.join(" | ")}`);
console.log(`status-badge samples=${statusBadge.samples.join(" | ")}`);

bindings.dispose();
provider.setTheme("neon");
await Promise.resolve();

console.log("");
console.log(`disposed count=${bindings.inspect().count}`);
