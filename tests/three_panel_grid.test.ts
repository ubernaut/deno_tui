import { assertEquals, assertNotEquals, assertNotStrictEquals } from "./deps.ts";
import {
  fingerprintThreePanelGrid,
  hasThreePanelGridCells,
  threePanelBlankGrid,
  ThreePanelGridPublicationCache,
  ThreePanelGridPublisher,
} from "../src/app/three_panel_grid.ts";

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

Deno.test("ThreePanelGridPublicationCache skips repeated revisioned grids", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, revision: 1 }), true);
  assertEquals(cache.shouldPublish({ grid, revision: 1 }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], revision: 2 }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], revision: 3 }), true);
});

Deno.test("ThreePanelGridPublicationCache preserves unrevisioned identity and fingerprint behavior", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, currentGrid: [] }), true);
  assertEquals(cache.shouldPublish({ grid, currentGrid: grid }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], currentGrid: grid, forceUpdate: true }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], currentGrid: grid }), true);
});

Deno.test("ThreePanelGridPublicationCache reset allows a matching grid to publish again", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid }), true);
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), false);
  cache.reset();
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), true);
});

Deno.test("ThreePanelGridPublisher reuses blank grids and resets buffers", () => {
  const publisher = new ThreePanelGridPublisher();
  const first = publisher.blankGridFor(3, 2);

  assertEquals(first, [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
  assertEquals(publisher.blankGridFor(3, 2), first);

  const resized = publisher.blankGridFor(2, 1);
  assertEquals(resized, [[" ", " "]]);
  assertNotEquals(resized, first);

  publisher.reset();
  assertNotStrictEquals(publisher.blankGridFor(2, 1), resized);
});

Deno.test("ThreePanelGridPublisher projects publication decisions with renderer-backed state", () => {
  const publisher = new ThreePanelGridPublisher();
  const grid = [["A"]];

  assertEquals(publisher.shouldPublish({ grid, currentGrid: [], rendererBacked: true }), {
    publish: true,
    grid,
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["A"]], currentGrid: grid, rendererBacked: true }), {
    publish: false,
    grid: [["A"]],
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["B"]], currentGrid: grid }), {
    publish: true,
    grid: [["B"]],
    rendererBacked: false,
  });
});

Deno.test("hasThreePanelGridCells reports visible grid dimensions", () => {
  assertEquals(hasThreePanelGridCells([]), false);
  assertEquals(hasThreePanelGridCells([[]]), false);
  assertEquals(hasThreePanelGridCells([undefined]), false);
  assertEquals(hasThreePanelGridCells([[" "]]), true);
});
