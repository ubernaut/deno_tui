import { assertEquals } from "./deps.ts";
import { makeStyle } from "../app/styles.ts";

Deno.test("makeStyle expands short hex colors without changing ANSI output", () => {
  const style = makeStyle({ fg: "#0f8", bg: "123", bold: true });

  assertEquals(style("ok"), "\x1b[1;38;2;0;255;136;48;2;17;34;51mok\x1b[0m");
});

Deno.test("makeStyle returns identity style when no options are set", () => {
  assertEquals(makeStyle()("plain"), "plain");
});
