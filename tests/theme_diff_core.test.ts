import { assertEquals } from "./deps.ts";
import { diffThemeEnginesCore } from "../src/theme_diff_core.ts";

Deno.test("theme diff core previews token and component state changes", () => {
  const base = {
    theme: {
      tokens: {
        foreground: (value: string) => `fg:${value}`,
        accent: (value: string) => `accent:${value}`,
      },
    },
    componentNames: () => ["Button"],
    variants: () => ["danger"],
    component: (_component: string, variant = "default") => ({
      base: variant === "danger" ? (value: string) => `danger:${value}` : (value: string) => `fg:${value}`,
      focused: (value: string) => `focus:${value}`,
    }),
  };
  const next = {
    theme: {
      tokens: {
        foreground: (value: string) => `bright:${value}`,
        accent: (value: string) => `accent:${value}`,
      },
    },
    componentNames: () => ["Button"],
    variants: () => ["danger"],
    component: (_component: string, variant = "default") => ({
      base: variant === "danger" ? (value: string) => `danger:${value}` : (value: string) => `bright:${value}`,
      focused: (value: string) => `focus:${value}`,
    }),
  };

  const diff = diffThemeEnginesCore(base, next, {
    sample: "x",
    tokenNames: ["foreground", "accent"],
    states: ["base", "focused"],
  });

  assertEquals(diff.tokens.map((entry) => [entry.token, entry.before.styled, entry.after.styled]), [
    ["foreground", "fg:x", "bright:x"],
  ]);
  assertEquals(
    diff.components.map((
      entry,
    ) => [entry.component, entry.variant, entry.state, entry.before.styled, entry.after.styled]),
    [["Button", "default", "base", "fg:x", "bright:x"]],
  );
});

Deno.test("theme diff core can include unchanged values and custom variants", () => {
  const engine = {
    theme: { tokens: { foreground: (value: string) => `fg:${value}` } },
    componentNames: () => ["Button"],
    variants: () => ["ignored"],
    component: () => ({ base: (value: string) => `base:${value}` }),
  };

  const diff = diffThemeEnginesCore(engine, engine, {
    sample: "x",
    tokenNames: ["foreground"],
    states: ["base"],
    variants: () => ["custom"],
    includeUnchanged: true,
  });

  assertEquals(diff.tokens.length, 1);
  assertEquals(diff.components.map((entry) => [entry.variant, entry.before.styled]), [["custom", "base:x"]]);
});
