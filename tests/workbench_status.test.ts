import { assertEquals } from "./deps.ts";
import {
  workbenchEmptyWorkspaceMessage,
  workbenchHeaderHelp,
  workbenchStatusLeft,
  workbenchTileDensityLabel,
} from "../src/app/workbench/mod.ts";

Deno.test("workbench status helpers bucket tile density", () => {
  assertEquals(workbenchTileDensityLabel(-2), "wide");
  assertEquals(workbenchTileDensityLabel(0), "balanced");
  assertEquals(workbenchTileDensityLabel(Number.NaN), "balanced");
  assertEquals(workbenchTileDensityLabel(3), "dense");
});

Deno.test("workbench status helper composes optional diagnostics", () => {
  assertEquals(
    workbenchStatusLeft({ focus: "Inspector", theme: "Unit-01", tileDensity: 0 }),
    "focus Inspector | Unit-01 | tiles balanced",
  );
  assertEquals(
    workbenchStatusLeft({ focus: "Data", theme: "Unit-01", tileDensity: 1, diagnostics: "diag 1 warning" }),
    "focus Data | Unit-01 | tiles dense | diag 1 warning",
  );
});

Deno.test("workbench empty workspace messages classify closed minimized and hidden states", () => {
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{ closed: true }, { closed: true }] }),
    "All windows closed. Use New to add a widget window.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{ minimized: true }, { minimized: true }] }),
    "All open windows minimized. Press R or use the shelf to restore.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{}, { closed: true }] }),
    "No visible windows. Use New to add a widget window.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({
      windows: [{ minimized: true }],
      labels: { minimized: "All panels minimized. Press R or click restore." },
    }),
    "All panels minimized. Press R or click restore.",
  );
});

Deno.test("workbench header help adapts to available width", () => {
  assertEquals(workbenchHeaderHelp({ width: 20 }), "");
  assertEquals(workbenchHeaderHelp({ width: 40 }), "F10 menu  Q quit");
  assertEquals(workbenchHeaderHelp({ width: 56 }), "F10 menu  N new  Tab focus  Q quit");
  assertEquals(workbenchHeaderHelp({ width: 96 }), "F10 menu  N new  G config  Tab  M/F/R  Q quit");
  assertEquals(
    workbenchHeaderHelp({ width: 132 }),
    "F10 menu  N new  T theme  G config  C close  Tab focus  M/F/R  Q quit",
  );
  assertEquals(workbenchHeaderHelp({ width: 20, minVisibleWidth: 12 }), "F10 menu  Q quit");
});
