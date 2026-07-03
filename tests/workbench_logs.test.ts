import { assertEquals } from "./deps.ts";
import { workbenchLogRowsFromSourcesInto, workbenchLogRowsInto } from "../app/workbench_logs.ts";
import type { RowStyle } from "../app/workbench_rows.ts";

Deno.test("workbench log rows project docs into themed rows", () => {
  const rows = workbenchLogRowsInto([], ["one", "two"], { text: "#eee", surface: "#111" });

  assertEquals(rows, [
    { text: "one", fg: "#eee", bg: "#111", bold: undefined },
    { text: "two", fg: "#eee", bg: "#111", bold: undefined },
  ]);
});

Deno.test("workbench log rows reuse caller-owned row objects", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }];
  const firstRow = target[0];
  const rows = workbenchLogRowsInto(target, ["fresh"], { text: "#fff", surface: "#000" });

  assertEquals(rows === target, true);
  assertEquals(rows[0] === firstRow, true);
  assertEquals(rows[0], { text: "fresh", fg: "#fff", bg: "#000", bold: undefined });
});

Deno.test("workbench log rows project multiple sources without cloning source arrays", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }, { text: "old" }];
  const firstRow = target[0];
  const rows = workbenchLogRowsFromSourcesInto(target, [["docs"], ["event one", "event two"]], {
    text: "#fff",
    surface: "#000",
  });

  assertEquals(rows === target, true);
  assertEquals(rows[0] === firstRow, true);
  assertEquals(rows, [
    { text: "docs", fg: "#fff", bg: "#000", bold: undefined },
    { text: "event one", fg: "#fff", bg: "#000", bold: undefined },
    { text: "event two", fg: "#fff", bg: "#000", bold: undefined },
  ]);
});

Deno.test("workbench log rows trims stale retained rows", () => {
  const target: RowStyle[] = [{ text: "a" }, { text: "b" }];
  const rows = workbenchLogRowsInto(target, [], { text: "#fff", surface: "#000" });

  assertEquals(rows.length, 0);
});
