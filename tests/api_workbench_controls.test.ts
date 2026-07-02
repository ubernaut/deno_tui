import { assertEquals } from "./deps.ts";
import {
  apiWorkbenchButtonRowInto,
  apiWorkbenchCheckboxRowsInto,
  apiWorkbenchComboHeaderRowsInto,
  type ApiWorkbenchControlHitPlacement,
  apiWorkbenchControlIds,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlsRowsInto,
  apiWorkbenchControlTrack,
  apiWorkbenchDropdownHeaderRowInto,
  apiWorkbenchDropdownPopoverRect,
  apiWorkbenchInputRowInto,
  apiWorkbenchProgressRowInto,
  apiWorkbenchRadioRowsInto,
  apiWorkbenchSliderRowInto,
  apiWorkbenchSliderSetHit,
  apiWorkbenchStepperHitPlacementsInto,
  apiWorkbenchStepperRowInto,
  apiWorkbenchTextboxProjection,
  apiWorkbenchTextboxProjectionInto,
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

Deno.test("api workbench dropdown popover rectangle follows shared adapter geometry", () => {
  assertEquals(
    apiWorkbenchDropdownPopoverRect({
      rect: { column: 10, row: 4, width: 42, height: 12 },
      row: 9,
      items: ["Alpha", "Longer choice"],
      label: "Current",
    }),
    { column: 12, row: 9, width: 19, height: 4 },
  );
  assertEquals(
    apiWorkbenchDropdownPopoverRect({
      rect: { column: 1, row: 2, width: 10, height: 5 },
      row: 4,
      items: ["A", "B", "C"],
      label: "Tiny",
    }),
    { column: 3, row: 4, width: 16, height: 5 },
  );
});

Deno.test("api workbench textbox projection wraps reveals cursor and emits shared hit geometry", () => {
  const projection = apiWorkbenchTextboxProjection({
    rect: { column: 5, row: 10, width: 24, height: 8 },
    row: 12,
    lines: ["alpha beta gamma delta", "second line"],
    cursor: { x: 18, y: 0 },
    active: true,
  });

  assertEquals(projection.height, 5);
  assertEquals(projection.nextRow, 17);
  assertEquals(projection.hit, { column: 5, row: 12, width: 24, height: 5, id: "textbox", action: "focus" });
  assertEquals(
    projection.rows.map((entry) => ({
      row: entry.row,
      label: entry.labelText,
      body: entry.bodyText,
      cursor: entry.cursor,
      continuation: entry.continuation,
      header: entry.header,
      labelWidth: entry.labelWidth,
      bodyWidth: entry.bodyWidth,
    })),
    [
      {
        row: 12,
        label: "> TextBox",
        body: "alpha beta",
        cursor: false,
        continuation: false,
        header: true,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 13,
        label: "          ",
        body: "gamma delta",
        cursor: true,
        continuation: true,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 14,
        label: "          ",
        body: "second line",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 15,
        label: "          ",
        body: "",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 16,
        label: "          ",
        body: "",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
    ],
  );
});

Deno.test("api workbench textbox projection can reuse caller-owned rows", () => {
  const rows = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 22, height: 6 },
    row: 5,
    lines: ["alpha beta gamma", "tail"],
    cursor: { x: 2, y: 0 },
    active: false,
  }).rows;
  const first = rows[0];

  const projection = apiWorkbenchTextboxProjectionInto(rows, {
    rect: { column: 3, row: 8, width: 20, height: 5 },
    row: 9,
    lines: ["short"],
    cursor: { x: 5, y: 0 },
    active: true,
  });

  assertEquals(projection.rows === rows, true);
  assertEquals(projection.rows[0] === first, true);
  assertEquals(projection.rows.length, 4);
  assertEquals(projection.rows[0]?.row, 9);
  assertEquals(projection.rows[0]?.labelColumn, 3);
  assertEquals(projection.rows[0]?.bodyText, "short");

  const clipped = apiWorkbenchTextboxProjectionInto(rows, {
    rect: { column: 3, row: 8, width: 0, height: 5 },
    row: 9,
    lines: ["short"],
    cursor: { x: 0, y: 0 },
    active: true,
  });
  assertEquals(clipped.rows === rows, true);
  assertEquals(clipped.rows.length, 0);
});

Deno.test("api workbench textbox projection reuses caller-owned visual lines", () => {
  const visualLines = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 18, height: 4 },
    row: 5,
    lines: ["alpha beta gamma"],
    cursor: { x: 0, y: 0 },
    active: false,
  }).rows.map((row) => row.visualLine);
  const firstVisualLine = visualLines[0];

  const projection = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 18, height: 4 },
    row: 5,
    lines: ["short"],
    visualLines,
    cursor: { x: 0, y: 0 },
    active: false,
  });

  assertEquals(projection.rows[0]?.visualLine === firstVisualLine, true);
  assertEquals(projection.rows[0]?.visualLine.text, "short");
  assertEquals(visualLines.length, 1);
});

Deno.test("api workbench option rows project checkbox and radio controls with reusable storage", () => {
  const rows = apiWorkbenchCheckboxRowsInto([], [
    { label: "live preview", checked: true },
    { label: "compact rows", checked: false },
  ]);
  const first = rows[0];

  assertEquals(rows, [
    { id: "checkbox", value: "Checkboxes", options: undefined },
    { id: "checkbox", value: "✓ live preview", options: { indent: true, index: 0 } },
    { id: "checkbox", value: "✗ compact rows", options: { indent: true, index: 1 } },
  ]);

  apiWorkbenchRadioRowsInto(rows, [
    { label: "Fast", selected: false },
    { label: "Unit-01 Signal", selected: true },
  ], 1);

  assertEquals(rows[0] === first, true);
  assertEquals(rows, [
    { id: "radio", value: "Radio", options: { previous: true, next: true } },
    { id: "radio", value: "  ○ Fast", options: { indent: true, index: 0 } },
    { id: "radio", value: "> ● Unit-01 Signal", options: { indent: true, index: 1 } },
  ]);
});

Deno.test("api workbench combo header projection preserves responsive split and hit options", () => {
  assertEquals(
    apiWorkbenchComboHeaderRowsInto([], {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: true,
      rectWidth: 48,
    }),
    [
      {
        id: "combo",
        value: "Theme  ▾ Unit-01 Signal",
        options: { action: "activate", previous: undefined, next: undefined },
      },
    ],
  );

  assertEquals(
    apiWorkbenchComboHeaderRowsInto([], {
      title: "Theme combo",
      label: "Unit-01 Signal",
      expanded: false,
      rectWidth: 18,
      expandedGlyph: "v",
      collapsedGlyph: ">",
      previous: true,
      next: true,
    }),
    [
      {
        id: "combo",
        value: "Theme combo  >",
        options: { action: "activate", previous: true, next: true },
      },
      { id: "combo", value: "Unit-01 Signal", options: { indent: true } },
    ],
  );
});

Deno.test("api workbench simple control row projectors preserve renderer-neutral values", () => {
  const button = apiWorkbenchButtonRowInto(undefined, {
    id: "genericButton",
    label: "Generic Button",
    detail: "presses=3",
  });
  assertEquals(button, {
    id: "genericButton",
    value: "[ Generic Button ] presses=3",
    options: { button: true, action: undefined },
  });

  const reused = apiWorkbenchDropdownHeaderRowInto(button, {
    title: "Dropdown",
    label: "Primary",
    expanded: false,
    expandedGlyph: "v",
    collapsedGlyph: ">",
  });
  assertEquals(reused === button, true);
  assertEquals(reused, {
    id: "dropdown",
    value: "Dropdown  > Primary",
    options: { action: "toggle" },
  });

  assertEquals(
    apiWorkbenchInputRowInto(undefined, {
      title: "Input",
      text: "deno task health",
      active: true,
      cursorGlyph: "|",
    }),
    {
      id: "input",
      value: "Input     deno task health|",
      options: { action: "focus" },
    },
  );

  assertEquals(
    apiWorkbenchSliderRowInto(undefined, {
      track: { text: "██░░" },
      value: 5,
      max: 10,
    }),
    {
      id: "slider",
      value: "Slider    ██░░ 5/10",
      options: { previous: true, next: true },
    },
  );

  assertEquals(
    apiWorkbenchStepperRowInto(undefined, {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "review", label: "Review" },
        { id: "ship", label: "Ship" },
      ],
      activeIndex: 1,
      rectWidth: 48,
    }),
    {
      id: "stepper",
      value: "Stepper   ✓ Draft → [Review] → Ship",
      options: { previous: true, next: true },
    },
  );

  assertEquals(
    apiWorkbenchProgressRowInto(undefined, {
      track: { text: "██░░" },
      value: 50,
    }),
    {
      id: "slider",
      value: "Progress  ██░░ 50%",
      options: undefined,
    },
  );
});

Deno.test("api workbench controls panel rows project shared adapter order", () => {
  const rows = apiWorkbenchControlsRowsInto([], {
    buttonPressCount: 2,
    genericButtonPressCount: 3,
    modalOpen: true,
    slider: { track: { text: "██░░" }, value: 5, max: 10 },
    checkboxes: [
      { label: "live preview", checked: true },
      { label: "compact rows", checked: false },
    ],
    radio: {
      items: [
        { label: "Fast", selected: false },
        { label: "Unit-01 Signal", selected: true },
      ],
      activeIndex: 1,
    },
    combo: {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: true,
      rectWidth: 18,
    },
    dropdown: {
      title: "Dropdown",
      label: "Geometry",
      expanded: false,
    },
    input: {
      title: "Input",
      text: "deno task health",
      active: true,
    },
    stepper: {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "review", label: "Review" },
      ],
      activeIndex: 1,
      rectWidth: 42,
    },
    progress: {
      track: { text: "███░" },
      value: 75,
    },
  });

  assertEquals(rows.map((row) => [row.id, row.value, row.options]), [
    ["button", "[ Run Action ] presses=2", { button: true, action: undefined }],
    ["genericButton", "[ Generic Button ] presses=3", { button: true, action: undefined }],
    ["modal", "[ Open Modal ] state=open", { button: true, action: undefined }],
    ["slider", "Slider    ██░░ 5/10", { previous: true, next: true }],
    ["checkbox", "Checkboxes", undefined],
    ["checkbox", "✓ live preview", { indent: true, index: 0 }],
    ["checkbox", "✗ compact rows", { indent: true, index: 1 }],
    ["radio", "Radio", { previous: true, next: true }],
    ["radio", "  ○ Fast", { indent: true, index: 0 }],
    ["radio", "> ● Unit-01 Signal", { indent: true, index: 1 }],
    ["combo", "Theme  ▾", { action: "activate", previous: undefined, next: undefined }],
    ["combo", "Unit-01 Signal", { indent: true }],
    ["dropdown", "Dropdown  ▸ Geometry", { action: "toggle" }],
    ["input", "Input     deno task health▌", { action: "focus" }],
    ["stepper", "Stepper   ✓ Draft → [Review]", { previous: true, next: true }],
    ["textbox", "TextBox", { action: "focus" }],
    ["slider", "Progress  ███░ 75%", undefined],
  ]);

  const first = rows[0];
  apiWorkbenchControlsRowsInto(rows, {
    buttonPressCount: 4,
    genericButtonPressCount: 0,
    modalOpen: false,
    slider: { track: { text: "░░░░" }, value: 1, max: 10 },
    checkboxes: [],
    radio: { items: [], activeIndex: 0 },
    combo: { title: "Theme", label: "A", expanded: false, rectWidth: 80 },
    dropdown: { title: "Dropdown", label: "A", expanded: true },
    input: { title: "Input", text: "", active: false },
    stepper: { steps: [], activeIndex: 0, rectWidth: 20 },
    progress: { track: { text: "░░░░" }, value: 0 },
  });
  assertEquals(rows[0] === first, true);
  assertEquals(rows.at(-1), { id: "slider", value: "Progress  ░░░░ 0%", options: undefined });
});

Deno.test("api workbench controls panel rows keep terminal and web geometry in parity", () => {
  const projectedRows = apiWorkbenchControlsRowsInto([], {
    buttonPressCount: 1,
    genericButtonPressCount: 0,
    modalOpen: false,
    slider: { track: { text: "██░░" }, value: 5, max: 10 },
    checkboxes: [{ label: "live preview", checked: true }],
    radio: {
      items: [
        { label: "Fast", selected: true },
        { label: "Ship", selected: false },
      ],
      activeIndex: 0,
    },
    combo: {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: false,
      rectWidth: 24,
      previous: true,
      next: true,
    },
    dropdown: {
      title: "Dropdown",
      label: "Geometry",
      expanded: true,
    },
    input: {
      title: "Input",
      text: "abc",
      active: false,
    },
    stepper: {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "ship", label: "Ship" },
      ],
      activeIndex: 1,
      rectWidth: 40,
    },
    progress: { track: { text: "███░" }, value: 75 },
  });
  const terminal = projectRowsForAdapter(projectedRows, "radio");
  const web = projectRowsForAdapter(projectedRows, "radio");

  assertEquals(web, terminal);
  assertEquals(
    terminal.hits.filter((hit) => hit.id === "slider" && hit.action === "previous").length,
    1,
  );
  assertEquals(
    terminal.segments.some((segment) => segment.kind === "button" && segment.text === "[ Run Action ]"),
    true,
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

function projectRowsForAdapter(
  rows: readonly { id: (typeof apiWorkbenchControlIds)[number]; value: string; options?: unknown }[],
  activeId: (typeof apiWorkbenchControlIds)[number],
): { segments: ApiWorkbenchControlLineSegment[]; hits: ApiWorkbenchControlHitPlacement[] } {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  const projectedSegments: ApiWorkbenchControlLineSegment[] = [];
  const projectedHits: ApiWorkbenchControlHitPlacement[] = [];
  const rect = { column: 4, row: 2, width: 28, height: 64 };
  let row = rect.row;
  for (const controlRow of rows) {
    if (controlRow.id === "textbox" || controlRow.value.startsWith("Progress")) continue;
    row = apiWorkbenchControlLineInto(
      projectedSegments,
      projectedHits,
      controlRow.id,
      controlRow.value,
      rect,
      row,
      activeId,
      controlRow.options as Parameters<typeof apiWorkbenchControlLineInto>[7],
    );
    for (const segment of projectedSegments) segments.push({ ...segment });
    for (const hit of projectedHits) hits.push({ ...hit });
  }
  return { segments, hits };
}
