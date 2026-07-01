// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createThemeLayerStack, ThemeLayerStack } from "../src/theme.ts";
import { ThemeLayerStackImplementation } from "../src/theme_layer_stack.ts";

Deno.test("theme layer stack module backs the public facade class", () => {
  assertEquals(ThemeLayerStack.prototype instanceof ThemeLayerStackImplementation, true);

  const layers = createThemeLayerStack([
    {
      id: "accent",
      label: "Accent",
      options: { tokens: { accent: (text) => `!${text}!` } },
    },
    {
      id: "buttons",
      enabled: false,
      options: {
        components: {
          button: { base: { active: "accent" } },
        },
      },
    },
  ]);

  assertInstanceOf(layers, ThemeLayerStack);
  assertInstanceOf(layers, ThemeLayerStackImplementation);
  assertEquals(layers.ids(), ["accent", "buttons"]);
  assertEquals(layers.activeIds(), ["accent"]);
  assertEquals(layers.enable("buttons"), true);
  assertEquals(layers.activeIds(), ["accent", "buttons"]);
  assertEquals(layers.inspect().map((layer) => [layer.id, layer.enabled]), [
    ["accent", true],
    ["buttons", true],
  ]);
  assertEquals(layers.inspect()[1].components, [{ name: "button", variants: [] }]);

  layers.dispose();
});

Deno.test("theme layer stack implementation composes enabled layers only", () => {
  const layers = new ThemeLayerStackImplementation([
    {
      id: "base",
      options: { tokens: { foreground: (text) => `a${text}` } },
    },
    {
      id: "muted",
      enabled: false,
      options: { tokens: { muted: (text) => `b${text}` } },
    },
  ]);

  assertEquals(Object.keys(layers.compose().tokens ?? {}), ["foreground"]);
  layers.enable("muted");
  assertEquals(Object.keys(layers.compose().tokens ?? {}), ["foreground", "muted"]);
  layers.disable("base");
  assertEquals(Object.keys(layers.compose().tokens ?? {}), ["muted"]);

  layers.dispose();
});
