import { assertEquals, assertNotEquals } from "./deps.ts";
import { fingerprintThreePanelGrid, threePanelBlankGrid } from "../src/app/three_panel_grid.ts";

Deno.test("threePanelBlankGrid creates stable space-filled rows", () => {
  assertEquals(threePanelBlankGrid(-1, 2), [[], []]);
  assertEquals(threePanelBlankGrid(3, 2), [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
});

Deno.test("fingerprintThreePanelGrid distinguishes content shape and text", () => {
  const base = fingerprintThreePanelGrid([
    ["A", "B"],
    ["C", "D"],
  ]);

  assertEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "E"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B", "C"], ["D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["AB"], ["CD"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], undefined, ["C", "D"]]), base);
});
