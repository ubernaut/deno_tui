import { assertEquals } from "./deps.ts";
import { createAnsiStyle as createAnsiStyleFromModule, emptyStyle as emptyStyleFromModule } from "../src/theme_ansi.ts";
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

Deno.test("theme ANSI module matches theme public re-exports", () => {
  const spec = { foreground: "brightCyan" as const, background: [4, 8, 12] as const, bold: true };
  assertEquals(createAnsiStyle(spec)("x"), createAnsiStyleFromModule(spec)("x"));
  assertEquals(emptyStyle("plain"), emptyStyleFromModule("plain"));
});

Deno.test("theme standard component module matches theme public re-exports", () => {
  assertEquals(standardThemeComponentNames(), standardThemeComponentNamesFromModule());
  assertEquals(createStandardComponentThemeDefinitions(), createStandardComponentThemeDefinitionsFromModule());
  assertEquals(
    createStandardComponentThemeDefinitions({ components: ["Button", "CustomPanel"] }),
    createStandardComponentThemeDefinitionsFromModule({ components: ["Button", "CustomPanel"] }),
  );
});
