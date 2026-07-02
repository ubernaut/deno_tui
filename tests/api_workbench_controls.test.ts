import { assertEquals } from "./deps.ts";
import {
  type ApiWorkbenchControlHitPlacement,
  apiWorkbenchControlIds,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlTrack,
  apiWorkbenchSliderSetHit,
  apiWorkbenchStepperHitPlacementsInto,
  nextApiWorkbenchControlId,
  nextSortableDataColumn,
} from "../app/api_workbench_controls.ts";

Deno.test("api workbench control ids preserve keyboard traversal order", () => {
  assertEquals(apiWorkbenchControlIds[0], "button");
  assertEquals(apiWorkbenchControlIds.at(-1), "textbox");
  assertEquals(nextApiWorkbenchControlId("button", 1), "genericButton");
  assertEquals(nextApiWorkbenchControlId("textbox", -1), "stepper");
});

Deno.test("api workbench control traversal supports wrap and edge-aware tabbing", () => {
  assertEquals(nextApiWorkbenchControlId("textbox", 1), undefined);
  assertEquals(nextApiWorkbenchControlId("button", -1), undefined);
  assertEquals(nextApiWorkbenchControlId("textbox", 1, { wrap: true }), "button");
  assertEquals(nextApiWorkbenchControlId("button", -1, { wrap: true }), "textbox");
  assertEquals(nextApiWorkbenchControlId("radio", 3), "input");
});

Deno.test("api workbench sortable column traversal skips disabled columns", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "status", label: "Status", sortable: false },
    { id: "cpu", label: "CPU" },
    { id: "memory", label: "Memory" },
  ] as const;

  assertEquals(nextSortableDataColumn(columns, "name", 1)?.id, "cpu");
  assertEquals(nextSortableDataColumn(columns, "cpu", -1)?.id, "name");
  assertEquals(nextSortableDataColumn(columns, "memory", 1)?.id, "name");
  assertEquals(nextSortableDataColumn(columns, "status", 1)?.id, "cpu");
});

Deno.test("api workbench sortable column traversal handles empty sortable sets", () => {
  assertEquals(
    nextSortableDataColumn(
      [
        { id: "name", sortable: false },
        { id: "status", sortable: false },
      ],
      "name",
      1,
    ),
    undefined,
  );
});

Deno.test("api workbench control line projection emits segments and hit regions", () => {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  const nextRow = apiWorkbenchControlLineInto(
    segments,
    hits,
    "slider",
    "Slider  ███░ 3/10",
    { column: 2, row: 5, width: 20, height: 4 },
    6,
    "slider",
    { previous: true, next: true },
  );

  assertEquals(nextRow, 7);
  assertEquals(segments, [{
    kind: "line",
    text: "> Slider  ███░ 3/10 ",
    column: 2,
    row: 6,
    width: 20,
    active: true,
  }]);
  assertEquals(hits, [
    { column: 2, row: 6, width: 20, height: 1, id: "slider", action: "activate", index: undefined },
    { column: 2, row: 6, width: 10, height: 1, id: "slider", action: "previous", index: undefined },
    { column: 12, row: 6, width: 10, height: 1, id: "slider", action: "next", index: undefined },
  ]);
});

Deno.test("api workbench control line projection keeps button token segments scoped", () => {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  apiWorkbenchControlLineInto(
    segments,
    hits,
    "button",
    "[ Run ] presses=2",
    { column: 4, row: 1, width: 24, height: 3 },
    1,
    "textbox",
    { button: true, action: "focus", index: 3 },
  );

  assertEquals(segments, [
    { kind: "prefix", text: "  ", column: 4, row: 1, width: 2, active: false },
    { kind: "button", text: "[ Run ]", column: 6, row: 1, width: 7, active: false },
    { kind: "detail", text: " presses=2", column: 13, row: 1, width: 10, active: false },
  ]);
  assertEquals(hits, [
    { column: 4, row: 1, width: 24, height: 1, id: "button", action: "focus", index: 3 },
  ]);

  const firstSegment = segments[0];
  const firstHit = hits[0];
  apiWorkbenchControlLineInto(
    segments,
    hits,
    "checkbox",
    "Checkboxes",
    { column: 0, row: 0, width: 8, height: 1 },
    0,
    "checkbox",
  );
  assertEquals(segments[0] === firstSegment, true);
  assertEquals(hits[0] === firstHit, true);
  assertEquals(hits.length, 1);
});

Deno.test("api workbench control track projects clamped fill and slider hit geometry", () => {
  const track = apiWorkbenchControlTrack({ ratio: 0.42, boundsWidth: 80, reservedWidth: 20, maxWidth: 24 });
  assertEquals(track, {
    width: 24,
    filled: 10,
    text: "██████████░░░░░░░░░░░░░░",
  });
  assertEquals(
    apiWorkbenchSliderSetHit({ column: 3, row: 4, width: 80, height: 2 }, 9, track),
    { column: 15, row: 9, width: 24, height: 1, id: "slider", action: "set", index: undefined },
  );
  assertEquals(
    apiWorkbenchControlTrack({ ratio: 2, boundsWidth: 14, reservedWidth: 20, minWidth: 8, maxWidth: 24 }),
    { width: 8, filled: 8, text: "████████" },
  );
});

Deno.test("api workbench stepper hit placements clip and reuse caller storage", () => {
  const target = apiWorkbenchStepperHitPlacementsInto(
    [],
    [
      { label: "Draft", completed: true },
      { label: "Review" },
      { label: "Ship", disabled: true },
    ],
    1,
    { column: 4, row: 2, width: 24, height: 1 },
    7,
  );
  const first = target[0];

  assertEquals(target.map((entry) => [entry.column, entry.row, entry.width, entry.index]), [
    [16, 7, 7, 0],
  ]);
  assertEquals(target[0]?.id, "stepper");
  assertEquals(target[0]?.action, "activate");

  apiWorkbenchStepperHitPlacementsInto(
    target,
    [{ label: "One" }, { label: "Two" }],
    0,
    { column: 0, row: 0, width: 30, height: 1 },
    3,
    { columnOffset: 2, gap: 1 },
  );

  assertEquals(target[0] === first, true);
  assertEquals(target.map((entry) => [entry.column, entry.row, entry.width, entry.index]), [
    [2, 3, 5, 0],
    [8, 3, 3, 1],
  ]);
});
