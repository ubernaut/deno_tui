import type { StepperStep } from "../src/components/stepper.ts";
import type { CursorPosition, TextBoxVisualLine } from "../src/components/textbox.ts";
import { workbenchButtonPaintOptions } from "../src/app/workbench_button_style.ts";
import { wrappedControlOptionRowCount } from "../src/app/workbench_control_layout.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import {
  type ApiWorkbenchCheckboxOption,
  apiWorkbenchControlBaseStyle,
  apiWorkbenchControlButtonDetailStyle,
  type ApiWorkbenchControlHitAction,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineOptions,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineSegment,
  type ApiWorkbenchControlPaintStyle,
  apiWorkbenchControlsSnapshotRowsInto,
  apiWorkbenchControlTrack,
  apiWorkbenchDropdownPopoverRect,
  type ApiWorkbenchProjectedControlRow,
  type ApiWorkbenchRadioOption,
  type ApiWorkbenchRadioSourceOption,
  apiWorkbenchSliderSetHitInto,
  apiWorkbenchStepperHitPlacementsInto,
  apiWorkbenchTextboxCommandStyle,
  apiWorkbenchTextboxProjectionInto,
  type ApiWorkbenchTextboxProjectionRow,
  type ApiWorkbenchTextboxRenderCommand,
  apiWorkbenchTextboxRenderCommandsInto,
  type ApiWorkbenchWrappedOptionsRenderCommand,
  apiWorkbenchWrappedOptionsRenderCommandsInto,
  apiWorkbenchWrappedOptionStyle,
} from "./api_workbench_controls.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

export class ApiWorkbenchControlsViewBufferCache {
  readonly lineSegments: ApiWorkbenchControlLineSegment[] = [];
  readonly lineRenderCommands: ApiWorkbenchControlLineRenderCommand[] = [];
  readonly lineHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
  readonly projectedRows: ApiWorkbenchProjectedControlRow[] = [];
  readonly checkboxOptions: ApiWorkbenchCheckboxOption[] = [];
  readonly radioOptions: ApiWorkbenchRadioOption[] = [];
  readonly textboxProjectionRows: ApiWorkbenchTextboxProjectionRow[] = [];
  readonly textboxRenderCommands: ApiWorkbenchTextboxRenderCommand[] = [];
  readonly textboxVisualLines: TextBoxVisualLine[] = [];
  readonly wrappedOptionRenderCommands: ApiWorkbenchWrappedOptionsRenderCommand[] = [];
  readonly wrappedOptionHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
  readonly sliderSetHit: ApiWorkbenchControlHitPlacement = {
    column: 0,
    row: 0,
    width: 0,
    height: 1,
    id: "slider",
    action: "set",
  };
  readonly stepperHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
}

export interface ApiWorkbenchControlsViewHitAction {
  type: "control";
  id: ApiWorkbenchControlId;
  action?: ApiWorkbenchControlHitAction;
  index?: number;
}

export interface ApiWorkbenchControlsDropdownOverlay {
  kind: "control";
  coordinate: "workspace";
  rect: Rectangle;
  items: string[];
  selectedIndex?: number;
}

export interface ApiWorkbenchControlsViewState<Value extends string = string> {
  activeControl: ApiWorkbenchControlId;
  buttonPressCount: number;
  genericButtonPressCount: number;
  modalOpen: boolean;
  slider: {
    ratio: number;
    value: number;
    max: number;
  };
  checkboxLivePreview: boolean;
  checkboxCompactRows: boolean;
  radioOptions: readonly ApiWorkbenchRadioSourceOption<Value>[];
  radioSelectedValue: Value | undefined;
  radioActiveIndex: number;
  combo: {
    title: string;
    label: string;
    expanded: boolean;
    items: string[];
    selectedIndex?: number;
  };
  dropdown: {
    title: string;
    label: string;
    expanded: boolean;
    items: string[];
    selectedIndex?: number;
  };
  input: {
    title: string;
    text: string;
    active: boolean;
  };
  stepper: {
    steps: readonly StepperStep[];
    activeIndex: number;
  };
  progress: {
    ratio: number;
    value: number;
  };
  textbox: {
    lines: readonly string[];
    cursor: CursorPosition;
  };
}

export interface ApiWorkbenchControlsViewOptions<Value extends string = string> {
  frame: WorkbenchFrame;
  rect: Rectangle;
  state: ApiWorkbenchControlsViewState<Value>;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

export interface ApiWorkbenchControlsViewResult {
  dropdownOverlay?: ApiWorkbenchControlsDropdownOverlay;
}

export function renderApiWorkbenchControls<Value extends string = string>(
  options: ApiWorkbenchControlsViewOptions<Value>,
): ApiWorkbenchControlsViewResult {
  const { frame, rect, state, buffers, theme, contrastText, fit, paint, write, addHit } = options;
  const result: ApiWorkbenchControlsViewResult = {};
  let row = rect.row;

  const writeControl = (
    id: ApiWorkbenchControlId,
    value: string,
    controlOptions: ApiWorkbenchControlLineOptions = {},
  ) => {
    const startRow = row;
    const nextRow = apiWorkbenchControlLineInto(
      buffers.lineSegments,
      buffers.lineHitPlacements,
      id,
      value,
      rect,
      row,
      state.activeControl,
      controlOptions,
    );
    if (nextRow === row) return;
    const active = state.activeControl === id;
    const baseStyle = apiWorkbenchControlBaseStyle(theme, active);
    const renderCommands = apiWorkbenchControlLineRenderCommandsInto(
      buffers.lineRenderCommands,
      buffers.lineSegments,
      {
        rect,
        row: startRow,
        button: controlOptions.button,
      },
    );
    for (const command of renderCommands) {
      if (command.kind === "fill") {
        write(
          frame,
          command.row,
          command.column,
          paint(" ".repeat(command.width), { fg: theme.text, bg: theme.surface, bold: false }),
        );
        continue;
      }
      if (controlOptions.button) {
        const style = command.role === "button"
          ? workbenchButtonPaintOptions(theme, contrastText, active ? "active" : "base")
          : command.role === "detail"
          ? apiWorkbenchControlButtonDetailStyle(theme, active)
          : baseStyle;
        write(frame, command.row, command.column, paint(command.text, style));
      } else {
        write(frame, command.row, command.column, paint(command.text, baseStyle));
      }
    }
    addControlHits(buffers.lineHitPlacements, addHit);
    row = nextRow;
  };

  const sliderTrack = apiWorkbenchControlTrack({
    ratio: state.slider.ratio,
    boundsWidth: rect.width,
    reservedWidth: 20,
    maxWidth: 24,
  });
  const progressTrack = apiWorkbenchControlTrack({
    ratio: state.progress.ratio,
    boundsWidth: rect.width,
    reservedWidth: 18,
    maxWidth: 24,
  });

  apiWorkbenchControlsSnapshotRowsInto(buffers.projectedRows, {
    buttonPressCount: state.buttonPressCount,
    genericButtonPressCount: state.genericButtonPressCount,
    modalOpen: state.modalOpen,
    slider: {
      track: sliderTrack,
      value: state.slider.value,
      max: state.slider.max,
    },
    checkboxLivePreview: state.checkboxLivePreview,
    checkboxCompactRows: state.checkboxCompactRows,
    radioOptions: state.radioOptions,
    radioSelectedValue: state.radioSelectedValue,
    radioActiveIndex: state.radioActiveIndex,
    combo: {
      title: state.combo.title,
      label: state.combo.label,
      expanded: state.combo.expanded,
      rectWidth: rect.width,
    },
    dropdown: {
      title: state.dropdown.title,
      label: state.dropdown.label,
      expanded: state.dropdown.expanded,
    },
    input: state.input,
    stepper: {
      steps: state.stepper.steps,
      activeIndex: state.stepper.activeIndex,
      rectWidth: rect.width,
    },
    progress: {
      track: progressTrack,
      value: state.progress.value,
    },
    buffers: {
      checkboxes: buffers.checkboxOptions,
      radio: buffers.radioOptions,
    },
  });

  for (let index = 0; index < buffers.projectedRows.length; index += 1) {
    const controlRow = buffers.projectedRows[index]!;
    if (controlRow.id === "slider" && controlRow.value.startsWith("Progress")) {
      if (row < rect.row + rect.height) {
        write(
          frame,
          row,
          rect.column,
          paint(fit(controlRow.value, rect.width), {
            fg: theme.text,
            bg: theme.surface,
            bold: false,
          }),
        );
      }
      continue;
    }

    if (controlRow.id === "textbox") {
      row = renderApiWorkbenchTextboxControl({
        frame,
        rect,
        row,
        active: state.activeControl === "textbox",
        lines: state.textbox.lines,
        cursor: state.textbox.cursor,
        buffers,
        theme,
        paint,
        write,
        addHit,
      });
      continue;
    }

    const beforeRow = row;
    writeControl(controlRow.id, controlRow.value, controlRow.options);
    if (controlRow.id === "slider") {
      const sliderSetHit = apiWorkbenchSliderSetHitInto(buffers.sliderSetHit, rect, beforeRow, sliderTrack);
      addHit({
        column: sliderSetHit.column,
        row: sliderSetHit.row,
        width: sliderSetHit.width,
        height: sliderSetHit.height,
      }, {
        type: "control",
        id: sliderSetHit.id,
        action: sliderSetHit.action,
      });
    } else if (controlRow.id === "combo" && buffers.projectedRows[index + 1]?.id !== "combo") {
      renderApiWorkbenchWrappedOptions({
        frame,
        rect,
        startRow: row,
        id: "combo",
        items: state.combo.items,
        selectedIndex: state.combo.selectedIndex,
        activeId: state.activeControl,
        buffers,
        theme,
        paint,
        write,
        addHit,
      });
      row += wrappedControlOptionRowCount(state.combo.items, undefined, rect.width - 4);
    } else if (controlRow.id === "dropdown") {
      if (state.dropdown.expanded) {
        result.dropdownOverlay = {
          kind: "control",
          coordinate: "workspace",
          rect: apiWorkbenchDropdownPopoverRect({
            rect,
            row,
            items: state.dropdown.items,
            label: state.dropdown.label,
          }),
          items: state.dropdown.items,
          selectedIndex: state.dropdown.selectedIndex,
        };
      }
    } else if (controlRow.id === "stepper") {
      addInlineStepperHits({
        rect,
        row: beforeRow,
        steps: state.stepper.steps,
        activeIndex: state.stepper.activeIndex,
        target: buffers.stepperHitPlacements,
        addHit,
      });
    }
  }

  return result;
}

interface ApiWorkbenchTextboxControlRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  row: number;
  active: boolean;
  lines: readonly string[];
  cursor: CursorPosition;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

function renderApiWorkbenchTextboxControl(options: ApiWorkbenchTextboxControlRenderOptions): number {
  const { frame, rect, row, active, lines, cursor, buffers, theme, paint, write, addHit } = options;
  const projection = apiWorkbenchTextboxProjectionInto(buffers.textboxProjectionRows, {
    rect,
    row,
    lines,
    visualLines: buffers.textboxVisualLines,
    cursor,
    active,
  });
  if (projection.height <= 0) return projection.nextRow;
  const commands = apiWorkbenchTextboxRenderCommandsInto(buffers.textboxRenderCommands, projection.rows);
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchTextboxCommandStyle(theme, command, active)),
    );
  }
  addHit(projection.hit, {
    type: "control",
    id: "textbox",
    action: "focus",
  });
  return projection.nextRow;
}

interface ApiWorkbenchWrappedOptionsRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  startRow: number;
  id: ApiWorkbenchControlId;
  items: readonly string[];
  selectedIndex: number | undefined;
  activeId: ApiWorkbenchControlId;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

function renderApiWorkbenchWrappedOptions(options: ApiWorkbenchWrappedOptionsRenderOptions): void {
  const { frame, rect, startRow, id, items, selectedIndex, activeId, buffers, theme, paint, write, addHit } = options;
  const commands = apiWorkbenchWrappedOptionsRenderCommandsInto(
    buffers.wrappedOptionRenderCommands,
    buffers.wrappedOptionHitPlacements,
    {
      rect,
      startRow,
      id,
      items,
      selectedIndex,
      activeId,
    },
  );
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchWrappedOptionStyle(theme, command.active)),
    );
  }
  addControlHits(buffers.wrappedOptionHitPlacements, addHit);
}

function addControlHits(
  placements: readonly ApiWorkbenchControlHitPlacement[],
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void,
): void {
  for (let index = 0; index < placements.length; index += 1) {
    const hit = placements[index]!;
    addHit({ column: hit.column, row: hit.row, width: hit.width, height: hit.height }, {
      type: "control",
      id: hit.id,
      action: hit.action,
      index: hit.index,
    });
  }
}

interface AddInlineStepperHitsOptions {
  rect: Rectangle;
  row: number;
  steps: readonly StepperStep[];
  activeIndex: number;
  target: ApiWorkbenchControlHitPlacement[];
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

function addInlineStepperHits(options: AddInlineStepperHitsOptions): void {
  const placements = apiWorkbenchStepperHitPlacementsInto(
    options.target,
    options.steps,
    options.activeIndex,
    options.rect,
    options.row,
  );
  addControlHits(placements, options.addHit);
}
