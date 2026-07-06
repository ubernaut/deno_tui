import { assertEquals, assertInstanceOf, assertThrows } from "./deps.ts";
import { mergeThemeCatalogComponents } from "../src/theme_provider_preview.ts";
import {
  ThemeEngine as ThemeEngineModule,
  ThemeInheritanceError as ThemeInheritanceErrorModule,
} from "../src/theme_engine.ts";
import {
  createAnsiStyle as createAnsiStyleFromModule,
  createAnsiStyleMap,
  emptyStyle as emptyStyleFromModule,
} from "../src/theme_ansi.ts";
import {
  createStandardComponentThemeDefinitions as createStandardComponentThemeDefinitionsFromModule,
  standardThemeComponentNames as standardThemeComponentNamesFromModule,
} from "../src/theme_standard_components.ts";
import {
  compileThemeManifestStateDefinition,
  compileThemeManifestStyleReference,
  createAnsiStyle,
  createStandardComponentThemeDefinitions,
  createThemeEngine,
  createThemeEngineFromPalette,
  createThemeLayerStack,
  createThemeRegistry,
  diffThemeEngines,
  emptyStyle,
  inspectThemeCoverage,
  standardThemeComponentNames,
  ThemeEngine,
  ThemeInheritanceError,
  ThemeLayerStack,
  ThemePackNotFoundError,
  ThemeRegistry,
} from "../src/theme.ts";
import type { ComponentThemeDefinition, ThemeStyleReference } from "../src/theme.ts";
import { validateThemeComponentsCore } from "../src/theme_validation_core.ts";

Deno.test("theme catalog merge sorts components and variants with default first", () => {
  assertEquals(
    mergeThemeCatalogComponents(
      [
        { name: "modal", variants: ["danger", "default"] },
        { name: "button", variants: ["primary"] },
      ],
      [
        { name: "button", variants: ["secondary", "primary"] },
        { name: "table", variants: [] },
      ],
    ),
    [
      { name: "button", variants: ["default", "primary", "secondary"] },
      { name: "modal", variants: ["default", "danger"] },
      { name: "table", variants: ["default"] },
    ],
  );
});

Deno.test("theme ANSI module matches theme public re-exports", () => {
  const spec = { foreground: "brightCyan" as const, background: [4, 8, 12] as const, bold: true };
  assertEquals(createAnsiStyle(spec)("x"), createAnsiStyleFromModule(spec)("x"));
  assertEquals(emptyStyle("plain"), emptyStyleFromModule("plain"));
  assertEquals(createAnsiStyleMap<"accent">({ accent: spec }).accent?.("x"), createAnsiStyle(spec)("x"));
});

Deno.test("theme standard component module matches theme public re-exports", () => {
  assertEquals(standardThemeComponentNames(), standardThemeComponentNamesFromModule());
  assertEquals(createStandardComponentThemeDefinitions(), createStandardComponentThemeDefinitionsFromModule());
  assertEquals(
    createStandardComponentThemeDefinitions({ components: ["Button", "CustomPanel"] }),
    createStandardComponentThemeDefinitionsFromModule({ components: ["Button", "CustomPanel"] }),
  );
});

Deno.test("theme layer stack exposes public layer lifecycle behavior", () => {
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

Deno.test("theme layer stack composes enabled layers only", () => {
  const layers = createThemeLayerStack([
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

Deno.test("theme registry public facade stores packs and builds engines", () => {
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

Deno.test("theme registry composes pack options and overrides", () => {
  const registry = createThemeRegistry([
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
  ]);

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
});

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

Deno.test("theme diff previews token and component state changes", () => {
  const buttonDefinition: ComponentThemeDefinition = {
    base: {
      base: "foreground",
      focused: (value: string) => `focus:${value}`,
      active: (value: string) => `active:${value}`,
      disabled: (value: string) => `disabled:${value}`,
    },
    variants: {
      danger: {
        base: (value: string) => `danger:${value}`,
        focused: (value: string) => `focus:${value}`,
        active: (value: string) => `active:${value}`,
        disabled: (value: string) => `disabled:${value}`,
      },
    },
  };

  const base = createThemeEngine("plain", {
    tokens: {
      foreground: (value: string) => `fg:${value}`,
      accent: (value: string) => `accent:${value}`,
    },
    components: { Button: buttonDefinition },
  });
  const next = createThemeEngine("plain", {
    tokens: {
      foreground: (value: string) => `bright:${value}`,
      accent: (value: string) => `accent:${value}`,
    },
    components: { Button: buttonDefinition },
  });

  const diff = diffThemeEngines(base, next, {
    sample: "x",
    components: ["Button"],
    variants: () => ["default", "danger"],
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

Deno.test("theme diff can include unchanged values and custom variants", () => {
  const engine = createThemeEngine("plain", {
    tokens: { foreground: (value: string) => `fg:${value}` },
    components: {
      Button: {
        variants: {
          custom: {
            base: (value: string) => `base:${value}`,
            focused: (value: string) => `focus:${value}`,
            active: (value: string) => `active:${value}`,
            disabled: (value: string) => `disabled:${value}`,
          },
        },
      },
    },
  });

  const diff = diffThemeEngines(engine, engine, {
    sample: "x",
    components: ["Button"],
    variants: () => ["custom"],
    includeUnchanged: true,
  });

  assertEquals(diff.tokens.find((entry) => entry.token === "foreground")?.before.styled, "fg:x");
  assertEquals(diff.components.map((entry) => [entry.variant, entry.state, entry.before.styled]), [
    ["custom", "base", "base:x"],
    ["custom", "focused", "focus:x"],
    ["custom", "active", "active:x"],
    ["custom", "disabled", "disabled:x"],
  ]);
});

Deno.test("theme coverage reports inherited component and variant state coverage", () => {
  const coverage = inspectThemeCoverage({
    components: {
      Field: {
        base: { base: emptyStyle, focused: emptyStyle },
      },
      Button: {
        extends: "Field",
        variants: {
          danger: { active: emptyStyle, disabled: emptyStyle },
        },
      },
    },
  }, {
    components: ["Button", "Field", "Missing"],
  });

  assertEquals(coverage, {
    componentCount: 3,
    variantCount: 4,
    stateCount: 16,
    coveredStateCount: 8,
    missingStateCount: 8,
    complete: false,
    components: [
      {
        name: "Button",
        extends: ["Field"],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
          { name: "danger", states: ["base", "focused", "active", "disabled"], missingStates: [], complete: true },
        ],
        stateCount: 8,
        coveredStateCount: 6,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Field",
        extends: [],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
        ],
        stateCount: 4,
        coveredStateCount: 2,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Missing",
        extends: [],
        variants: [
          { name: "default", states: [], missingStates: ["base", "focused", "active", "disabled"], complete: false },
        ],
        stateCount: 4,
        coveredStateCount: 0,
        missingStateCount: 4,
        complete: false,
      },
    ],
  });
});

Deno.test("theme coverage supports custom variant enumeration and inheritance cycle errors", () => {
  const coverage = inspectThemeCoverage({
    components: {
      Button: {
        variants: { danger: { base: emptyStyle } },
      },
    },
  }, {
    variants: () => ["quiet"],
  });

  assertEquals(coverage.components[0]?.variants.map((variant) => variant.name), ["default", "quiet"]);

  assertThrows(
    () =>
      inspectThemeCoverage({
        components: {
          A: { extends: "B" },
          B: { extends: "A" },
        },
      }),
    ThemeInheritanceError,
    "A -> B -> A",
  );
});

Deno.test("theme manifest core compiles token names ansi specs and pipelines", () => {
  const token = compileThemeManifestStyleReference("accent");
  const style = compileThemeManifestStyleReference({ foreground: "brightCyan", bold: true });
  const pipeline = compileThemeManifestStyleReference(["muted", { foreground: [1, 2, 3] }]);

  assertEquals(token, "accent");
  assertEquals(typeof style, "function");
  assertEquals(callCompiledStyle(style, "x"), "\x1b[1;96mx\x1b[0m");
  assertEquals(Array.isArray(pipeline), true);
  assertEquals((pipeline as unknown[]).length, 2);
});

Deno.test("theme manifest core compiles generic state maps without undefined entries", () => {
  const state = compileThemeManifestStateDefinition({
    base: "foreground",
    active: { foreground: "yellow" },
  });

  assertEquals(state.base, "foreground");
  assertEquals(typeof state.active, "function");
  assertEquals(Object.keys(state).sort(), ["active", "base"]);
});

Deno.test("theme validation core reports unknown token references inside pipelines", () => {
  const issues = validateThemeComponentsCore({
    Button: {
      base: {
        active: ["accent", "missing-token"],
      },
    },
  }, { tokenNames: ["accent"] });

  assertEquals(issues, [{
    kind: "unknown-token",
    path: "components.Button.base.active[1]",
    component: "Button",
    variant: undefined,
    state: "active",
    reference: "missing-token",
    message: 'Theme state "Button.active" references unknown token "missing-token"',
  }]);
});

Deno.test("theme validation core reports unknown parents and inheritance cycles", () => {
  const issues = validateThemeComponentsCore({
    Panel: { extends: ["Missing", "Card"] },
    Card: { extends: "Panel" },
  }, { tokenNames: ["accent"] });

  assertEquals(issues.map((issue) => issue.kind), ["unknown-component", "inheritance-cycle"]);
  assertEquals(issues[0]?.path, "components.Panel.extends");
  assertEquals(issues[0]?.reference, "Missing");
  assertEquals(issues[1]?.message, "Theme component inheritance cycle detected: Card -> Panel -> Card");
});

function callCompiledStyle(reference: ThemeStyleReference, value: string): string {
  if (typeof reference !== "function") throw new Error("expected compiled style function");
  return reference(value);
}
