import { assertEquals } from "./deps.ts";
import { createAnsiStyle as createAnsiStyleFromModule, emptyStyle as emptyStyleFromModule } from "../src/theme_ansi.ts";
import { createAnsiStyle, emptyStyle } from "../src/theme.ts";

Deno.test("theme ANSI module matches theme public re-exports", () => {
  const spec = { foreground: "brightCyan" as const, background: [4, 8, 12] as const, bold: true };
  assertEquals(createAnsiStyle(spec)("x"), createAnsiStyleFromModule(spec)("x"));
  assertEquals(emptyStyle("plain"), emptyStyleFromModule("plain"));
});
