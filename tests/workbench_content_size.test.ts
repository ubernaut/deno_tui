import { assertEquals } from "./deps.ts";
import {
  explorerTextRowsInto,
  projectedTextWidth,
  workbenchDataContentWidth,
  workbenchWindowContentSize,
} from "../app/workbench_panels.ts";

const base = {
  id: "inspector",
  viewport: { column: 4, row: 2, width: 20, height: 10 },
  docs: ["short", "a much longer log row"],
  explorerRows: ["src", "  mod.ts"],
  dataColumns: [{ width: 4 }, { width: 8 }],
  dataRowCount: 30,
  terminalOutputLines: ["stdout one", "stderr line"],
  terminalOutputWindowId: "terminalOutput",
  terminalShellWindowId: "terminalShell",
  isVisualizationWindow: (id: string) => id.startsWith("viz:"),
  visualizationContentSize: (_id: string, _viewport: unknown, baseWidth: number, baseHeight: number) => ({
    width: baseWidth + 3,
    height: baseHeight + 4,
  }),
};

Deno.test("workbenchWindowContentSize estimates built-in window content", () => {
  assertEquals(workbenchWindowContentSize({ ...base, id: "explorer" }), { width: 20, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "controls" }), { width: 20, height: 44 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "inspector" }), { width: 20, height: 18 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "logs" }), { width: 23, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "data" }), { width: 24, height: 34 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "three" }), { width: 20, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "htmlLayout" }), { width: 20, height: 20 });
  assertEquals(workbenchWindowContentSize({ ...base, id: "unknown" }), { width: 20, height: 16 });
});

Deno.test("workbenchWindowContentSize clamps terminal content dimensions", () => {
  assertEquals(workbenchWindowContentSize({ ...base, id: "terminalShell" }), { width: 72, height: 24 });
  assertEquals(
    workbenchWindowContentSize({
      ...base,
      id: "terminalOutput",
      terminalOutputLines: ["x".repeat(300), "ok"],
    }),
    { width: 120, height: 16 },
  );
  assertEquals(
    workbenchWindowContentSize({
      ...base,
      id: "terminalOutput",
      viewport: { column: 0, row: 0, width: 140, height: 30 },
      terminalOutputLines: Array.from({ length: 40 }, (_, index) => `line ${index}`),
    }),
    { width: 140, height: 44 },
  );
});

Deno.test("workbenchWindowContentSize delegates visualization windows", () => {
  assertEquals(workbenchWindowContentSize({ ...base, id: "viz:cpu" }), { width: 23, height: 14 });
});

Deno.test("workbench content-size helpers reuse text rows and measure projected text", () => {
  const target = ["stale"];
  const rows = explorerTextRowsInto(target, [{ text: "alpha" }, { text: "beta gamma" }], (entry) => entry.text);

  assertEquals(rows, target);
  assertEquals(rows, ["alpha", "beta gamma"]);
  assertEquals(projectedTextWidth([{ text: "alpha" }, { text: "beta gamma" }], (entry) => entry.text), 10);
  assertEquals(workbenchDataContentWidth([{ width: 4 }, {}, { width: 6 }]), 36);
});
