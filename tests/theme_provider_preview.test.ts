// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createThemeLayerStack,
  createThemeProvider,
  createThemeRegistry,
  themeStates,
  themeTokenNames,
} from "../src/theme.ts";
import { createThemeCatalogFromInspection, previewThemeProviderCore } from "../src/theme_provider_preview.ts";

Deno.test("theme provider preview builds catalog from inspection", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        label: "Ops",
        options: {
          components: {
            button: { variants: { danger: { active: "danger" } } },
          },
        },
      },
    ]),
    activeId: "ops",
    layers: createThemeLayerStack([
      {
        id: "layer",
        label: "Layer",
        options: {
          components: {
            panel: { base: { active: "accent" } },
          },
        },
      },
    ]),
  });

  const catalog = createThemeCatalogFromInspection(provider.inspect(), themeTokenNames, themeStates);
  assertEquals(catalog.activeId, "ops");
  assertEquals(catalog.themes.map((theme) => [theme.id, theme.active]), [["ops", true]]);
  assertEquals(catalog.layers.map((layer) => [layer.id, layer.active]), [["layer", true]]);
  assertEquals(catalog.components.map((component) => component.name), ["button", "panel"]);
});

Deno.test("theme provider preview honors token component state and variant filters", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        options: {
          tokens: {
            accent: (text) => `<${text}>`,
            danger: (text) => `!${text}!`,
          },
          components: {
            button: {
              base: { active: "accent" },
              variants: { danger: { active: "danger" } },
            },
          },
        },
      },
    ]),
    activeId: "ops",
  });

  const preview = previewThemeProviderCore(
    provider,
    {
      sample: "Go",
      tokens: ["danger", "accent"],
      components: ["button"],
      states: ["active"],
      variants: () => ["danger"],
    },
    themeTokenNames,
    themeStates,
  );

  assertEquals(preview.tokens.map((token) => token.token), ["accent", "danger"]);
  assertEquals(preview.components.map((component) => [component.component, component.variant, component.state]), [
    ["button", "danger", "active"],
  ]);
  assertStringIncludes(preview.tokens[0].preview.styled, "Go");
  assertEquals(preview.components[0].preview.styled, "!Go!");
});
