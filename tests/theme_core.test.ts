import { assertEquals } from "./deps.ts";
import { mergeThemeCatalogComponents } from "../src/theme_catalog.ts";
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
  createAnsiStyle,
  createStandardComponentThemeDefinitions,
  emptyStyle,
  standardThemeComponentNames,
} from "../src/theme.ts";
import {
  type CompiledThemeManifestStyleReferenceCore,
  compileThemeManifestStateDefinitionCore,
  compileThemeManifestStyleReferenceCore,
} from "../src/theme_manifest_core.ts";
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

Deno.test("theme manifest core compiles token names ansi specs and pipelines", () => {
  const token = compileThemeManifestStyleReferenceCore("accent");
  const style = compileThemeManifestStyleReferenceCore({ foreground: "brightCyan", bold: true });
  const pipeline = compileThemeManifestStyleReferenceCore(["muted", { foreground: [1, 2, 3] }]);

  assertEquals(token, "accent");
  assertEquals(typeof style, "function");
  assertEquals(callCompiledStyle(style, "x"), "\x1b[1;96mx\x1b[0m");
  assertEquals(Array.isArray(pipeline), true);
  assertEquals((pipeline as unknown[]).length, 2);
});

Deno.test("theme manifest core compiles generic state maps without undefined entries", () => {
  const state = compileThemeManifestStateDefinitionCore<"base" | "active">({
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

function callCompiledStyle(reference: CompiledThemeManifestStyleReferenceCore, value: string): string {
  if (typeof reference !== "function") throw new Error("expected compiled style function");
  return reference(value);
}
