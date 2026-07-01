// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  alignGridItemBounds,
  gridSpanSize,
  gridTrackOffsets,
  hitRegionForNode,
  placeGridChildren,
  resolveGridTracks,
} from "../src/layout/solvers/simple_grid.ts";
import { cellLength, defaultComputedLayoutStyle, frLength, percentLength } from "../src/layout/style.ts";
import { createLayoutNode, type LayoutNode } from "../src/layout/solver.ts";

Deno.test("simple grid placement honors explicit cells before auto-flow", () => {
  const explicit = gridNode("explicit", { columnStart: 2, rowStart: 1 });
  const autoA = gridNode("auto-a");
  const rowFixed = gridNode("row-fixed", { rowStart: 2 });
  const autoB = gridNode("auto-b");

  const placed = placeGridChildren([autoA, explicit, rowFixed, autoB], {
    columns: 3,
    rows: 2,
    autoFlow: "row",
  });

  assertEquals(
    placed.map((item) => [item.node.id, item.column, item.row, item.columnSpan, item.rowSpan]),
    [
      ["auto-a", 0, 0, 1, 1],
      ["explicit", 1, 0, 1, 1],
      ["row-fixed", 0, 1, 1, 1],
      ["auto-b", 2, 0, 1, 1],
    ],
  );
});

Deno.test("simple grid track helpers resolve fixed percent fr auto gap and spans", () => {
  const tracks = resolveGridTracks(
    [cellLength(4), percentLength(25), frLength(1)],
    4,
    24,
    1,
    frLength(1),
  );
  assertEquals(tracks, [4, 5, 6, 6]);
  assertEquals(gridTrackOffsets(2, tracks, 1), [2, 7, 13, 20]);
  assertEquals(gridSpanSize(tracks, 1, 3, 1), 19);
});

Deno.test("simple grid alignment and hit region helpers preserve solver contracts", () => {
  const node = gridNode("centered");
  node.style.justifySelf = "center";
  node.style.alignSelf = "end";
  node.style.width = cellLength(4);
  node.style.height = cellLength(2);

  assertEquals(alignGridItemBounds(node, { column: 10, row: 5, width: 10, height: 5 }), {
    column: 13,
    row: 8,
    width: 4,
    height: 2,
  });
  assertEquals(hitRegionForNode(node, { column: 1, row: 2, width: 3, height: 4 }, 7), {
    id: "centered",
    bounds: { column: 1, row: 2, width: 3, height: 4 },
    zIndex: 7,
    payload: { nodeId: "centered", tag: "div" },
  });
});

function gridNode(
  id: string,
  options: { columnStart?: number; rowStart?: number; columnSpan?: number; rowSpan?: number } = {},
): LayoutNode {
  const style = defaultComputedLayoutStyle();
  style.gridColumn = { start: options.columnStart, span: options.columnSpan };
  style.gridRow = { start: options.rowStart, span: options.rowSpan };
  return createLayoutNode({ id, tag: "div", style });
}
