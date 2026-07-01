import { assertEquals } from "./deps.ts";
import {
  type CompiledThemeManifestStyleReferenceCore,
  compileThemeManifestStateDefinitionCore,
  compileThemeManifestStyleReferenceCore,
} from "../src/theme_manifest_core.ts";

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

function callCompiledStyle(reference: CompiledThemeManifestStyleReferenceCore, value: string): string {
  if (typeof reference !== "function") throw new Error("expected compiled style function");
  return reference(value);
}
