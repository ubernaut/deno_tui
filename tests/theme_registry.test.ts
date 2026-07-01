// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createThemeRegistry, ThemeEngine, ThemePackNotFoundError, ThemeRegistry } from "../src/theme.ts";
import { ThemePackNotFoundErrorImplementation, ThemeRegistryImplementation } from "../src/theme_registry.ts";

Deno.test("theme registry module backs the public facade classes", () => {
  assertEquals(ThemeRegistry.prototype instanceof ThemeRegistryImplementation, true);
  assertEquals(ThemePackNotFoundError.prototype instanceof ThemePackNotFoundErrorImplementation, true);

  const registry = createThemeRegistry([
    {
      id: "ops",
      label: "Ops",
      palette: "terminal",
      options: {
        components: {
          button: { variants: { danger: { active: "danger" } } },
        },
      },
    },
  ]);

  assertInstanceOf(registry, ThemeRegistry);
  assertInstanceOf(registry, ThemeRegistryImplementation);
  assertEquals(registry.ids(), ["ops"]);
  assertEquals(registry.inspect(), [
    {
      id: "ops",
      label: "Ops",
      palette: "terminal",
      components: [{ name: "button", variants: ["danger"] }],
    },
  ]);
  assertInstanceOf(registry.engine("ops"), ThemeEngine);
  assertThrows(() => registry.engine("missing"), ThemePackNotFoundError, 'Theme pack "missing" is not registered');
});

Deno.test("theme registry implementation composes packs overrides and custom errors", () => {
  class CustomMissingPack extends Error {}
  const registry = new ThemeRegistryImplementation([
    {
      id: "base",
      palette: "plain",
      options: {
        tokens: { accent: (text) => `a${text}` },
        components: {
          label: { base: { active: "accent" } },
        },
      },
    },
  ], {
    createNotFoundError: (id) => new CustomMissingPack(id),
  });

  const engine = registry.engine("base", {
    tokens: { accent: (text) => `b${text}` },
    components: {
      button: { base: { active: "accent" } },
    },
  });

  assertEquals(registry.has("base"), true);
  assertEquals(registry.get("base")?.id, "base");
  assertEquals(engine.inspect().components, [
    { name: "button", variants: [] },
    { name: "label", variants: [] },
  ]);
  assertEquals(engine.resolve("button", "active")("x"), "bx");
  assertThrows(() => registry.engine("missing"), CustomMissingPack);
});
