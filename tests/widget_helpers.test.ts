import { assertEquals } from "./deps.ts";
import { bindCheckBoxCommands, checkBoxCommands } from "../src/app/checkbox_commands.ts";
import { bindMenuBarCommands, menuBarCommands } from "../src/app/menu_bar_commands.ts";
import { bindRadioGroupCommands, radioGroupCommands } from "../src/app/radio_group_commands.ts";
import { bindScrollAreaCommands, scrollAreaCommands } from "../src/app/scroll_area_commands.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { bindSliderCommands, sliderCommands } from "../src/app/slider_commands.ts";
import { bindStepperCommands, stepperCommands } from "../src/app/stepper_commands.ts";
import { bindTabsCommands, tabsCommands } from "../src/app/tabs_commands.ts";
import { formatKeyBinding, KeymapRegistry } from "../src/keymap.ts";
import { renderBreadcrumbs } from "../src/components/breadcrumbs.ts";
import { CheckBoxController, Mark, renderCheckBoxMark } from "../src/components/checkbox.ts";
import { renderEmptyState } from "../src/components/empty_state.ts";
import { renderKeyHelp } from "../src/components/key_help.ts";
import { virtualRows, visibleListRows } from "../src/components/list.ts";
import {
  clampMenuIndex,
  MenuBarController,
  menuItemForIndex,
  renderMenuBar,
  shiftMenuIndex,
} from "../src/components/menu_bar.ts";
import {
  clampRadioIndex,
  optionForValue,
  RadioGroupController,
  renderRadioGroupRows,
  shiftRadioIndex,
  visibleRadioOptions,
} from "../src/components/radio_group.ts";
import {
  clampScrollOffset,
  maxScrollOffset,
  ScrollAreaController,
  scrollbarGlyph,
  scrollbarThumb,
  scrollOffsetBy,
} from "../src/components/scroll_area.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { clampSliderValue, SliderController, sliderThumbRectangle, sliderValueBy } from "../src/components/slider.ts";
import { renderSpinner, spinnerGlyph } from "../src/components/spinner.ts";
import {
  clampStepperIndex,
  renderStepper,
  shiftStepperIndex,
  stepForIndex,
  StepperController,
} from "../src/components/stepper.ts";
import { clampTabIndex, renderTabs, shiftTabIndex, tabForIndex, TabsController } from "../src/components/tabs.ts";
import { TextLineCache } from "../src/components/textbox.ts";
import { renderVirtualListRows, VirtualListController, virtualListRows } from "../src/components/virtual_list.ts";
import type { Key, KeyPressEvent } from "../src/input_reader/types.ts";
import { Signal } from "../src/signals/mod.ts";

Deno.test("visibleListRows centers the selected item when space allows", () => {
  assertEquals(visibleListRows(["alpha", "beta", "gamma", "delta"], 2, 3), [
    "  beta",
    "> gamma",
    "  delta",
  ]);
});

Deno.test("virtualRows exposes source indices for large lists", () => {
  assertEquals(virtualRows(["a", "b", "c", "d", "e"], 3, 3), [
    { item: "c", index: 2, selected: false },
    { item: "d", index: 3, selected: true },
    { item: "e", index: 4, selected: false },
  ]);
});

Deno.test("virtual list rows support formatted multi selection windows", () => {
  const items = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const state = { activeIndex: 3, anchorIndex: 1, selected: [1, 3] };

  assertEquals(virtualListRows(items, state, 3, (item, index) => `${index}:${item}`), [
    { item: "gamma", index: 2, active: false, selected: false, text: "2:gamma" },
    { item: "delta", index: 3, active: true, selected: true, text: "3:delta" },
    { item: "epsilon", index: 4, active: false, selected: false, text: "4:epsilon" },
  ]);
  assertEquals(renderVirtualListRows(items, state, 3), [
    "    gamma",
    "> ● delta",
    "    epsilon",
  ]);
});

Deno.test("VirtualListController drives viewport rows and key navigation", () => {
  const controller = new VirtualListController({
    items: ["alpha", "beta", "gamma", "delta", "epsilon"],
    mode: "multiple",
    format: (item, index) => `${index}:${item}`,
  });

  controller.setViewportHeight(3);
  controller.handleKeyPress(keyPress("down", { shift: true }));
  controller.handleKeyPress(keyPress("down", { shift: true }));

  assertEquals(controller.inspect(), {
    itemCount: 5,
    mode: "multiple",
    activeIndex: 2,
    selected: [0, 1, 2],
    selectedItems: ["alpha", "beta", "gamma"],
    window: { start: 1, end: 4 },
  });
  assertEquals(controller.rows.peek().map((row) => row.text), ["1:beta", "2:gamma", "3:delta"]);

  controller.handleKeyPress(keyPress("pagedown"));
  assertEquals(controller.inspect().activeIndex, 4);
  assertEquals(controller.handleKeyPress(keyPress("return")), "epsilon");
  controller.dispose();
});

Deno.test("VirtualListController syncs selected values and external state", () => {
  const selection = new Signal({ activeIndex: 0, anchorIndex: 0, selected: [0] });
  const controller = new VirtualListController({
    items: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ],
    mode: "multiple",
    selection,
    valueForItem: (item) => item.id,
  });

  controller.selectValues(["c", "a"]);

  assertEquals(controller.selectedValues(), ["a", "c"]);
  assertEquals(selection.peek(), { activeIndex: 2, anchorIndex: 2, selected: [0, 2] });

  controller.items.value = [
    { id: "a", label: "Alpha" },
    { id: "c", label: "Gamma" },
  ];
  assertEquals(controller.inspect().itemCount, 2);
  assertEquals(controller.inspect().selected, [0, 1]);
  controller.dispose();
});

Deno.test("CheckBoxController toggles and inspects boolean state", () => {
  const changes: boolean[] = [];
  const checked = new Signal(false);
  const controller = new CheckBoxController({
    checked,
    onChange: (next) => void changes.push(next),
  });

  assertEquals(renderCheckBoxMark(false), Mark.Cross);
  assertEquals(controller.inspect(), { checked: false, mark: Mark.Cross });
  assertEquals(controller.toggle(), true);
  assertEquals(controller.check(), true);
  assertEquals(controller.uncheck(), false);
  assertEquals(checked.peek(), false);
  assertEquals(changes, [true, true, false]);
  controller.dispose();
  checked.dispose();
});

Deno.test("checkBoxCommands toggle check and uncheck state", async () => {
  const controller = new CheckBoxController({ checked: false });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindCheckBoxCommands(registry, controller, {
    id: "autosave",
    idPrefix: "settings.autosave",
    group: "settings",
  });

  assertEquals(checkBoxCommands(new CheckBoxController({ checked: false })).map((command) => command.id), [
    "checkbox.toggle",
    "checkbox.check",
    "checkbox.uncheck",
  ]);
  assertEquals(registry.list("settings").map((command) => command.id), [
    "settings.autosave.check",
    "settings.autosave.toggle",
    "settings.autosave.uncheck",
  ]);
  assertEquals(registry.enabled(registry.get("settings.autosave.uncheck")!), false);

  assertEquals(await registry.execute("settings.autosave.toggle", (action) => void actions.push(action)), true);
  assertEquals(controller.checked.peek(), true);
  assertEquals(registry.enabled(registry.get("settings.autosave.check")!), false);
  assertEquals(await registry.execute("settings.autosave.uncheck", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1), {
    type: "checkbox.changed",
    payload: {
      id: "autosave",
      checked: false,
      inspection: { checked: false, mark: Mark.Cross },
    },
  });

  dispose();
  assertEquals(registry.list("settings"), []);
  controller.dispose();
});

Deno.test("renderTabs marks the active tab", () => {
  const tabs = [
    { id: "one", label: "One" },
    { id: "two", label: "Two", disabled: true },
    { id: "three", label: "Three" },
  ];

  assertEquals(
    renderTabs(tabs, 2),
    " One   (Two)  [Three]",
  );
  assertEquals(shiftTabIndex(tabs, 0, 1), 2);
  assertEquals(clampTabIndex(tabs, 1), 2);
  assertEquals(tabForIndex(tabs, 1)?.id, "three");
});

Deno.test("TabsController navigates and inspects tab state", () => {
  const changes: string[] = [];
  const controller = new TabsController({
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "logs", label: "Logs", disabled: true },
      { id: "settings", label: "Settings" },
    ],
    activeIndex: 1,
    onChange: (tab) => void changes.push(tab.id),
  });

  assertEquals(controller.inspect(), {
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "logs", label: "Logs", disabled: true },
      { id: "settings", label: "Settings" },
    ],
    tabCount: 3,
    activeIndex: 2,
    active: { id: "settings", label: "Settings" },
    empty: false,
  });
  assertEquals(controller.move(-1)?.id, "overview");
  controller.handleKeyPress(keyPress("right"));
  controller.handleKeyPress(keyPress("home"));
  assertEquals(controller.active()?.id, "overview");
  assertEquals(changes, ["overview", "settings", "overview"]);
  controller.dispose();
});

Deno.test("tabsCommands move and select tabs", async () => {
  const controller = new TabsController({
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "logs", label: "Logs", disabled: true },
      { id: "settings", label: "Settings" },
    ],
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindTabsCommands(registry, controller, {
    id: "main",
    idPrefix: "tabs.main",
    group: "tabs",
    includeTabCommands: true,
  });

  assertEquals(tabsCommands(new TabsController({ tabs: [] })).map((command) => command.id), [
    "tabs.first",
    "tabs.previous",
    "tabs.next",
    "tabs.last",
  ]);
  assertEquals(registry.list("tabs").map((command) => command.id), [
    "tabs.main.first",
    "tabs.main.tab.logs",
    "tabs.main.tab.overview",
    "tabs.main.tab.settings",
    "tabs.main.last",
    "tabs.main.next",
    "tabs.main.previous",
  ]);

  assertEquals(await registry.execute("tabs.main.next", (action) => void actions.push(action)), true);
  assertEquals(controller.active()?.id, "settings");
  assertEquals(await registry.execute("tabs.main.tab.logs", (action) => void actions.push(action)), false);
  assertEquals(await registry.execute("tabs.main.tab.overview", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1), {
    type: "tabs.tabSelected",
    payload: {
      id: "main",
      tab: { id: "overview", label: "Overview" },
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("tabs"), []);
  controller.dispose();
});

Deno.test("renderBreadcrumbs truncates from the left", () => {
  const items = [
    { id: "app", label: "App" },
    { id: "settings", label: "Settings" },
    { id: "runtime", label: "Runtime" },
  ];

  assertEquals(renderBreadcrumbs(items, "/"), "App / Settings / Runtime");
  assertEquals(renderBreadcrumbs(items, "/", 12), "… / Runtime");
  assertEquals(renderBreadcrumbs(items, "/", 6), "… / R…");
});

Deno.test("renderEmptyState centers and truncates content", () => {
  assertEquals(
    renderEmptyState(
      {
        icon: "-",
        title: "No results found",
        message: "Try a different filter",
        action: "Press / to search",
      },
      12,
      6,
    ),
    ["", "-", "No results …", "Try a diffe…", "Press / to …"],
  );
  assertEquals(renderEmptyState({ title: "Nothing here", message: "Add an item" }, 20, 1), ["Nothing here"]);
  assertEquals(renderEmptyState({ title: "Nothing here" }, 0, 2, false), [""]);
});

Deno.test("menu bar renders active item and skips disabled entries", () => {
  const items = [
    { id: "file", label: "File" },
    { id: "edit", label: "Edit", disabled: true },
    { id: "view", label: "View" },
  ];

  assertEquals(renderMenuBar(items, 0), "[File] (Edit) View");
  assertEquals(shiftMenuIndex(items, 0, 1), 2);
  assertEquals(clampMenuIndex(items, 1), 2);
  assertEquals(menuItemForIndex(items, 1)?.id, "view");
});

Deno.test("MenuBarController navigates selects and inspects menu state", () => {
  const changes: string[] = [];
  const selections: string[] = [];
  const controller = new MenuBarController({
    items: [
      { id: "file", label: "File" },
      { id: "edit", label: "Edit", disabled: true },
      { id: "view", label: "View" },
    ],
    activeIndex: 1,
    onChange: (item) => void changes.push(item.id),
    onSelect: (item) => void selections.push(item.id),
  });

  assertEquals(controller.inspect(), {
    items: [
      { id: "file", label: "File" },
      { id: "edit", label: "Edit", disabled: true },
      { id: "view", label: "View" },
    ],
    itemCount: 3,
    activeIndex: 2,
    active: { id: "view", label: "View" },
    empty: false,
  });
  assertEquals(controller.move(-1)?.id, "file");
  controller.handleKeyPress(keyPress("right"));
  assertEquals(controller.selectActive()?.id, "view");
  controller.handleKeyPress(keyPress("home"));
  controller.handleKeyPress(keyPress("space"));
  assertEquals(changes, ["file", "view", "file"]);
  assertEquals(selections, ["view", "file"]);
  controller.dispose();
});

Deno.test("menuBarCommands move and select menu items", async () => {
  const controller = new MenuBarController({
    items: [
      { id: "file", label: "File" },
      { id: "edit", label: "Edit", disabled: true },
      { id: "view", label: "View" },
    ],
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindMenuBarCommands(registry, controller, {
    id: "main",
    idPrefix: "menubar.main",
    group: "menu",
    includeItemCommands: true,
  });

  assertEquals(menuBarCommands(new MenuBarController({ items: [] })).map((command) => command.id), [
    "menu.first",
    "menu.previous",
    "menu.next",
    "menu.last",
    "menu.select",
  ]);
  assertEquals(registry.list("menu").map((command) => command.id), [
    "menubar.main.first",
    "menubar.main.last",
    "menubar.main.next",
    "menubar.main.previous",
    "menubar.main.select",
    "menubar.main.item.edit",
    "menubar.main.item.file",
    "menubar.main.item.view",
  ]);

  assertEquals(await registry.execute("menubar.main.next", (action) => void actions.push(action)), true);
  assertEquals(controller.active()?.id, "view");
  assertEquals(await registry.execute("menubar.main.item.edit", (action) => void actions.push(action)), false);
  assertEquals(await registry.execute("menubar.main.item.file", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1), {
    type: "menuBar.itemSelected",
    payload: {
      id: "main",
      item: { id: "file", label: "File" },
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("menu"), []);
  controller.dispose();
});

Deno.test("radio group renders selected state and skips disabled options", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", disabled: true },
    { value: "c", label: "Gamma" },
  ];

  assertEquals(renderRadioGroupRows(options, "c", 0, 3), [
    "> ○ Alpha",
    "  ○ (Beta)",
    "  ● Gamma",
  ]);
  assertEquals(shiftRadioIndex(options, 0, 1), 2);
  assertEquals(shiftRadioIndex(options, 2, -1), 0);
  assertEquals(clampRadioIndex(options, 1), 2);
  assertEquals(optionForValue(options, "c")?.label, "Gamma");
  assertEquals(visibleRadioOptions(options, 2, 2).map((row) => row.index), [1, 2]);
});

Deno.test("RadioGroupController navigates selects and inspects option state", () => {
  const changes: string[] = [];
  const selectedValue = new Signal<string | undefined>("c");
  const controller = new RadioGroupController({
    options: [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta", disabled: true },
      { value: "c", label: "Gamma" },
    ],
    selectedValue,
    activeIndex: 1,
    onChange: (option) => void changes.push(option.value),
  });

  assertEquals(controller.inspect(), {
    options: [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta", disabled: true },
      { value: "c", label: "Gamma" },
    ],
    optionCount: 3,
    activeIndex: 2,
    active: { value: "c", label: "Gamma" },
    selectedValue: "c",
    selected: { value: "c", label: "Gamma" },
    empty: false,
  });
  assertEquals(controller.move(-1)?.value, "a");
  assertEquals(controller.selectActive()?.value, "a");
  assertEquals(selectedValue.peek(), "a");
  assertEquals(controller.selectValue("b"), undefined);
  controller.handleKeyPress(keyPress("end"));
  controller.handleKeyPress(keyPress("space"));
  assertEquals(changes, ["a", "c"]);
  controller.dispose();
  selectedValue.dispose();
});

Deno.test("radioGroupCommands move and select options", async () => {
  const controller = new RadioGroupController({
    options: [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta", disabled: true },
      { value: "c", label: "Gamma" },
    ],
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindRadioGroupCommands(registry, controller, {
    id: "priority",
    idPrefix: "radio.priority",
    group: "form",
    includeOptionCommands: true,
  });

  assertEquals(radioGroupCommands(new RadioGroupController({ options: [] })).map((command) => command.id), [
    "radio.first",
    "radio.previous",
    "radio.next",
    "radio.last",
    "radio.select",
  ]);
  assertEquals(registry.list("form").map((command) => command.id), [
    "radio.priority.first",
    "radio.priority.last",
    "radio.priority.next",
    "radio.priority.previous",
    "radio.priority.select",
    "radio.priority.option.a",
    "radio.priority.option.b",
    "radio.priority.option.c",
  ]);

  assertEquals(await registry.execute("radio.priority.next", (action) => void actions.push(action)), true);
  assertEquals(controller.active()?.value, "c");
  assertEquals(await registry.execute("radio.priority.option.b", (action) => void actions.push(action)), false);
  assertEquals(await registry.execute("radio.priority.option.a", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1), {
    type: "radioGroup.optionSelected",
    payload: {
      id: "priority",
      option: { value: "a", label: "Alpha" },
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("form"), []);
  controller.dispose();
});

Deno.test("slider helpers clamp values and compute thumb rectangles", () => {
  assertEquals(clampSliderValue(12, 0, 10), 10);
  assertEquals(clampSliderValue(-2, 0, 10), 0);
  assertEquals(sliderValueBy(4, 0, 10, 2, 3), 10);
  assertEquals(sliderThumbRectangle({ column: 2, row: 3, width: 10, height: 2 }, 5, 0, 10, "horizontal"), {
    column: 7,
    row: 3,
    width: 1,
    height: 2,
  });
  assertEquals(sliderThumbRectangle({ column: 2, row: 3, width: 2, height: 10 }, 5, 0, 10, "vertical", true), {
    column: 2,
    row: 8,
    width: 2,
    height: 1,
  });
});

Deno.test("SliderController handles keyboard mouse and inspection state", () => {
  const changes: number[] = [];
  const value = new Signal(4);
  const controller = new SliderController({
    min: 0,
    max: 10,
    step: 2,
    value,
    orientation: "horizontal",
    adjustThumbSize: true,
    onChange: (next) => void changes.push(next),
  });

  controller.handleKeyPress(keyPress("right"));
  controller.handleDrag(2, 0);
  controller.handleScroll(-1);
  controller.handleKeyPress(keyPress("home"));
  controller.handleKeyPress(keyPress("end"));

  assertEquals(value.peek(), 10);
  assertEquals(changes, [6, 10, 8, 0, 10]);
  assertEquals(controller.inspect(), {
    min: 0,
    max: 10,
    step: 2,
    value: 10,
    normalizedValue: 1,
    orientation: "horizontal",
    adjustThumbSize: true,
    range: 10,
  });
  assertEquals(controller.thumbRectangle({ column: 0, row: 0, width: 10, height: 1 }), {
    column: 9,
    row: 0,
    width: 1,
    height: 1,
  });
  controller.dispose();
  value.dispose();
});

Deno.test("sliderCommands drive value changes and presets", async () => {
  const controller = new SliderController({
    min: 0,
    max: 10,
    step: 2,
    value: 4,
    orientation: "horizontal",
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindSliderCommands(registry, controller, {
    id: "volume",
    idPrefix: "slider.volume",
    group: "controls",
    includeValueCommands: true,
    values: [0, 4, 10],
  });

  assertEquals(
    sliderCommands(new SliderController({ min: 0, max: 1, step: 1, value: 0, orientation: "horizontal" })).map((
      command,
    ) => command.id),
    [
      "slider.decrement",
      "slider.increment",
      "slider.min",
      "slider.max",
    ],
  );
  assertEquals(registry.list("controls").map((command) => command.id), [
    "slider.volume.decrement",
    "slider.volume.increment",
    "slider.volume.max",
    "slider.volume.min",
    "slider.volume.value.0",
    "slider.volume.value.10",
    "slider.volume.value.4",
  ]);

  assertEquals(await registry.execute("slider.volume.increment", (action) => void actions.push(action)), true);
  assertEquals(controller.value.peek(), 6);
  assertEquals(await registry.execute("slider.volume.value.10", (action) => void actions.push(action)), true);
  assertEquals(registry.enabled(registry.get("slider.volume.value.10")!), false);
  assertEquals(actions.at(-1), {
    type: "slider.changed",
    payload: {
      id: "volume",
      value: 10,
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("controls"), []);
  controller.dispose();
});

Deno.test("stepper renders progress and skips disabled steps", () => {
  const steps = [
    { id: "plan", label: "Plan", completed: true },
    { id: "build", label: "Build" },
    { id: "ship", label: "Ship", disabled: true },
    { id: "verify", label: "Verify" },
  ];

  assertEquals(renderStepper(steps, 1), ["✓ Plan → [Build] → (Ship) → Verify"]);
  assertEquals(renderStepper(steps, 1, "horizontal", 12), ["✓ Plan → [B…"]);
  assertEquals(renderStepper(steps, 3, "vertical"), [
    "  ✓ Plan",
    "  ○ Build",
    "  - (Ship)",
    "> ○ Verify",
  ]);
  assertEquals(shiftStepperIndex(steps, 1, 1), 3);
  assertEquals(shiftStepperIndex(steps, 3, -1), 1);
  assertEquals(clampStepperIndex(steps, 2), 3);
  assertEquals(stepForIndex(steps, 2)?.id, "verify");
});

Deno.test("StepperController navigates and inspects workflow state", () => {
  const changes: string[] = [];
  const controller = new StepperController({
    steps: [
      { id: "plan", label: "Plan", completed: true },
      { id: "build", label: "Build" },
      { id: "ship", label: "Ship", disabled: true },
      { id: "verify", label: "Verify" },
    ],
    activeIndex: 1,
    orientation: "vertical",
    onChange: (step) => void changes.push(step.id),
  });

  assertEquals(controller.inspect(), {
    steps: [
      { id: "plan", label: "Plan", completed: true },
      { id: "build", label: "Build" },
      { id: "ship", label: "Ship", disabled: true },
      { id: "verify", label: "Verify" },
    ],
    stepCount: 4,
    activeIndex: 1,
    active: { id: "build", label: "Build" },
    orientation: "vertical",
    empty: false,
  });
  assertEquals(controller.move(1)?.id, "verify");
  controller.handleKeyPress(keyPress("up"));
  assertEquals(controller.active()?.id, "build");
  assertEquals(controller.last()?.id, "verify");
  assertEquals(changes, ["verify", "build", "verify"]);
  controller.dispose();
});

Deno.test("stepperCommands move and select steps", async () => {
  const controller = new StepperController({
    steps: [
      { id: "plan", label: "Plan" },
      { id: "build", label: "Build" },
      { id: "ship", label: "Ship", disabled: true },
    ],
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindStepperCommands(registry, controller, {
    id: "release",
    idPrefix: "wizard.release",
    group: "wizard",
    includeStepCommands: true,
  });

  assertEquals(stepperCommands(new StepperController({ steps: [] })).map((command) => command.id), [
    "stepper.first",
    "stepper.previous",
    "stepper.next",
    "stepper.last",
  ]);
  assertEquals(registry.list("wizard").map((command) => command.id), [
    "wizard.release.first",
    "wizard.release.step.build",
    "wizard.release.step.plan",
    "wizard.release.step.ship",
    "wizard.release.last",
    "wizard.release.next",
    "wizard.release.previous",
  ]);

  assertEquals(await registry.execute("wizard.release.next", (action) => void actions.push(action)), true);
  assertEquals(controller.active()?.id, "build");
  assertEquals(await registry.execute("wizard.release.step.ship", (action) => void actions.push(action)), false);
  assertEquals(await registry.execute("wizard.release.step.plan", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1), {
    type: "stepper.stepSelected",
    payload: {
      id: "release",
      step: { id: "plan", label: "Plan" },
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("wizard"), []);
  controller.dispose();
});

Deno.test("spinner renders status glyphs and truncates labels", () => {
  assertEquals(spinnerGlyph("loading", 5, ["a", "b", "c"]), "c");
  assertEquals(spinnerGlyph("success"), "✓");
  assertEquals(spinnerGlyph("error"), "!");
  assertEquals(spinnerGlyph("idle"), " ");
  assertEquals(renderSpinner("Loading data", "loading", 1, ["|", "/"], 20), "/ Loading data");
  assertEquals(renderSpinner("Loading data", "loading", 1, ["|", "/"], 8), "/ Loadi…");
});

Deno.test("scroll helpers clamp offsets and expose scrollbar thumb state", () => {
  const max = maxScrollOffset(80, 40, 20, 10);
  assertEquals(max, { columns: 60, rows: 30 });
  assertEquals(clampScrollOffset({ columns: 70, rows: -4 }, max), { columns: 60, rows: 0 });
  assertEquals(scrollOffsetBy({ columns: 10, rows: 10 }, max, -2, 25), { columns: 8, rows: 30 });

  const thumb = scrollbarThumb(40, 10, 15);
  assertEquals(thumb, { start: 4, size: 3, visible: true });
  assertEquals(scrollbarGlyph(3, thumb), "│");
  assertEquals(scrollbarGlyph(4, thumb), "█");
  assertEquals(scrollbarThumb(8, 10, 0).visible, false);
});

Deno.test("ScrollAreaController inspects and clamps viewport offsets", () => {
  const controller = new ScrollAreaController({
    contentWidth: 80,
    contentHeight: 40,
    viewportWidth: 20,
    viewportHeight: 10,
    offset: { columns: 90, rows: 15 },
  });

  assertEquals(controller.inspect(), {
    contentWidth: 80,
    contentHeight: 40,
    viewportWidth: 20,
    viewportHeight: 10,
    maxOffset: { columns: 60, rows: 30 },
    offset: { columns: 60, rows: 15 },
    horizontalThumb: { start: 15, size: 5, visible: true },
    verticalThumb: { start: 4, size: 3, visible: true },
    visibleColumns: { start: 60, end: 80 },
    visibleRows: { start: 15, end: 25 },
    canScrollColumns: true,
    canScrollRows: true,
    showScrollbar: true,
  });

  assertEquals(controller.scrollBy(-10, 100), { columns: 50, rows: 30 });
  assertEquals(controller.setViewportSize(100, 100), { columns: 0, rows: 0 });
  controller.setScrollbarVisible(false);
  assertEquals(controller.inspect().showScrollbar, false);
  controller.dispose();
});

Deno.test("scrollAreaCommands drive movement and scrollbar visibility", async () => {
  const controller = new ScrollAreaController({
    contentWidth: 80,
    contentHeight: 40,
    viewportWidth: 20,
    viewportHeight: 10,
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindScrollAreaCommands(registry, controller, {
    id: "main",
    idPrefix: "viewport.main",
    group: "viewport",
    includeScrollbarCommands: true,
  });

  assertEquals(scrollAreaCommands(new ScrollAreaController()).map((command) => command.id), [
    "scroll.up",
    "scroll.down",
    "scroll.left",
    "scroll.right",
    "scroll.pageUp",
    "scroll.pageDown",
    "scroll.home",
    "scroll.end",
  ]);
  assertEquals(registry.list("viewport").map((command) => command.id), [
    "viewport.main.scrollbar.hide",
    "viewport.main.pageDown",
    "viewport.main.pageUp",
    "viewport.main.down",
    "viewport.main.end",
    "viewport.main.home",
    "viewport.main.left",
    "viewport.main.right",
    "viewport.main.up",
    "viewport.main.scrollbar.show",
  ]);

  assertEquals(await registry.execute("viewport.main.pageDown", (action) => void actions.push(action)), true);
  assertEquals(controller.offset.peek(), { columns: 0, rows: 9 });
  assertEquals(await registry.execute("viewport.main.end", (action) => void actions.push(action)), true);
  assertEquals(controller.offset.peek(), { columns: 0, rows: 30 });
  assertEquals(await registry.execute("viewport.main.scrollbar.hide", (action) => void actions.push(action)), true);
  assertEquals(controller.showScrollbar.peek(), false);
  assertEquals(actions.at(-1), {
    type: "scrollArea.scrollbarChanged",
    payload: {
      id: "main",
      visible: false,
      inspection: controller.inspect(),
    },
  });

  dispose();
  assertEquals(registry.list("viewport"), []);
  controller.dispose();
});

Deno.test("renderStatusBar keeps left and right content inside width", () => {
  assertEquals(renderStatusBar("READY", "12:00", 12), "READY  12:00");
  assertEquals(renderStatusBar("LONG LEFT", "RIGHT", 8), "LONG LEF");
});

Deno.test("TextLineCache reuses line snapshots until text changes", () => {
  const cache = new TextLineCache();
  const first = cache.lines("alpha\nbeta");
  const second = cache.lines("alpha\nbeta");
  const third = cache.lines("alpha\nbeta\ngamma");

  assertEquals(first, ["alpha", "beta"]);
  assertEquals(first === second, true);
  assertEquals(first === third, false);
  assertEquals(third, ["alpha", "beta", "gamma"]);
  assertEquals(cache.inspect(), { text: "alpha\nbeta\ngamma", lineCount: 3 });
});

Deno.test("keymap registry formats sorted bindings", () => {
  const registry = new KeymapRegistry();
  registry.register({ key: "p", description: "palette", ctrl: true, group: "global" });
  registry.register({ key: "q", description: "quit", group: "global" });

  assertEquals(formatKeyBinding({ key: "p", description: "palette", ctrl: true }), "C-p palette");
  assertEquals(renderKeyHelp(registry.list("global"), 40), "C-p palette  q quit");
  assertEquals(registry.inspect("global"), {
    count: 2,
    groups: ["global"],
    bindings: [
      { id: "C-p", key: "p", description: "palette", ctrl: true, group: "global" },
      { id: "q", key: "q", description: "quit", group: "global" },
    ],
  });
});

Deno.test("keymap registry supports bulk registration replacement and clearing", () => {
  const registry = new KeymapRegistry();
  const disposeGlobal = registry.registerAll([
    { key: "q", description: "quit", group: "global" },
    { key: "s", description: "save", ctrl: true, group: "file" },
  ]);
  const disposeReplacement = registry.register({ key: "q", description: "quick open", group: "global" });

  assertEquals(registry.has({ key: "q" }), true);
  assertEquals(registry.get({ key: "q" })?.description, "quick open");
  assertEquals(registry.groups(), ["file", "global"]);

  disposeGlobal();
  assertEquals(registry.get({ key: "q" })?.description, "quick open");
  assertEquals(registry.has({ key: "s", ctrl: true }), false);

  disposeReplacement();
  assertEquals(registry.has({ key: "q" }), false);

  registry.registerAll([
    { key: "1", description: "one", group: "numbers" },
    { key: "2", description: "two", group: "numbers" },
    { key: "x", description: "exit", group: "global" },
  ]);
  registry.clear("numbers");
  assertEquals(registry.inspect(), {
    count: 1,
    groups: ["global"],
    bindings: [{ id: "x", key: "x", description: "exit", group: "global" }],
  });
  registry.clear();
  assertEquals(registry.inspect(), { count: 0, groups: [], bindings: [] });
});

function keyPress(key: Key, options: Partial<Omit<KeyPressEvent, "key" | "buffer">> = {}): KeyPressEvent {
  return {
    key,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    buffer: new Uint8Array(),
  };
}
