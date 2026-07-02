import { assertEquals } from "./deps.ts";
import {
  apiWorkbenchControlIds,
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
