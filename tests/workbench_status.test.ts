import { assertEquals } from "./deps.ts";
import { workbenchStatusLeft, workbenchTileDensityLabel } from "../src/app/workbench/mod.ts";

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
