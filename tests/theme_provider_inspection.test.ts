// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createThemeLayerStack,
  createThemeProvider,
  createThemeRegistry,
  type ThemeLayer,
  type ThemePack,
  validateThemeOptions,
} from "../src/theme.ts";
import {
  inspectThemeProviderIssues,
  themeProviderActiveOptions,
  themeRegistryOptions,
} from "../src/theme_provider_inspection.ts";

Deno.test("theme provider inspection composes active pack and layers", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "base",
        options: {
          tokens: { accent: (text) => `a${text}` },
          components: { label: { base: { active: "accent" } } },
        },
      },
    ]),
    activeId: "base",
    layers: createThemeLayerStack([
      {
        id: "enabled",
        options: {
          tokens: { danger: (text) => `d${text}` },
          components: { button: { base: { active: "danger" } } },
        },
      },
      {
        id: "disabled",
        enabled: false,
        options: { tokens: { muted: (text) => `m${text}` } },
      },
    ]),
  });

  const active = themeProviderActiveOptions(provider);
  assertEquals(Object.keys(active.tokens ?? {}), ["accent", "danger"]);
  assertEquals(Object.keys(active.components ?? {}), ["label", "button"]);
  assertEquals(themeRegistryOptions(provider).length, 1);
});

Deno.test("theme provider inspection attributes pack and layer validation issues", () => {
  const packs = [
    {
      id: "bad-pack",
      options: {
        components: { panel: { base: { active: "missing-token" } } },
      },
    },
  ] as unknown as ThemePack[];
  const layers = [
    {
      id: "bad-layer",
      options: {
        components: { button: { extends: "missing-parent" } },
      },
    },
    {
      id: "other-layer",
      options: {
        components: { other: { base: { active: "also-missing" } } },
      },
    },
  ] as unknown as ThemeLayer[];
  const provider = createThemeProvider({
    registry: createThemeRegistry(packs),
    activeId: "bad-pack",
    layers: createThemeLayerStack(layers),
  });

  const issues = inspectThemeProviderIssues(provider, validateThemeOptions);
  assertEquals(
    issues.map((issue) => [issue.source, issue.sourceId, issue.kind, issue.component]),
    [
      ["theme", "bad-pack", "unknown-token", "panel"],
      ["layer", "bad-layer", "unknown-component", "button"],
      ["layer", "other-layer", "unknown-token", "other"],
    ],
  );
});
