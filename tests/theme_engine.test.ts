// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createThemeEngine, createThemeEngineFromPalette, ThemeEngine, ThemeInheritanceError } from "../src/theme.ts";
import {
  ThemeEngine as ThemeEngineModule,
  ThemeInheritanceError as ThemeInheritanceErrorModule,
} from "../src/theme_engine.ts";

Deno.test("theme engine module backs the public facade classes", () => {
  assertEquals(ThemeEngine.prototype instanceof ThemeEngineModule, true);
  assertEquals(ThemeInheritanceError.prototype instanceof ThemeInheritanceErrorModule, true);

  const engine = createThemeEngine("plain", {
    components: {
      button: {
        base: { active: "accent" },
        variants: { danger: { active: "danger" } },
      },
    },
  });

  assertInstanceOf(engine, ThemeEngineModule);
  assertInstanceOf(engine, ThemeEngine);
  assertEquals(engine.inspect().tokens, [
    "foreground",
    "muted",
    "accent",
    "success",
    "warning",
    "danger",
    "surface",
  ]);
  assertEquals(engine.inspect().components, [{ name: "button", variants: ["danger"] }]);
  assertEquals(engine.componentNames(), ["button"]);
  assertEquals(engine.variants("button"), ["danger"]);
});

Deno.test("theme engine module preserves inheritance and extension behavior", () => {
  const engine = createThemeEngineFromPalette({}, {
    components: {
      base: { base: { base: "foreground" } },
      child: { extends: "base", variants: { selected: { focused: "accent" } } },
    },
  });
  const extended = engine.extend({
    components: {
      child: { variants: { danger: { active: "danger" } } },
    },
  });

  assertEquals(extended.componentNames(), ["base", "child"]);
  assertEquals(extended.variants("child"), ["danger", "selected"]);
  assertThrows(
    () =>
      new ThemeEngineModule({
        components: {
          a: { extends: "b" },
          b: { extends: "a" },
        },
      }).component("a"),
    ThemeInheritanceErrorModule,
    "a -> b -> a",
  );
  assertThrows(
    () =>
      createThemeEngine("plain", {
        components: {
          a: { extends: "b" },
          b: { extends: "a" },
        },
      }).component("a"),
    ThemeInheritanceError,
    "a -> b -> a",
  );
});
