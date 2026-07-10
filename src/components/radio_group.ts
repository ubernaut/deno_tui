// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import {
  ActiveItemController,
  BOUNDED_ACTIVE_ITEM_INDEX_POLICY,
  clampActiveItemIndex,
  cloneActiveItems,
  shiftActiveItemIndex,
} from "./active_item.ts";
import { stackedRowIndexAt } from "./interaction.ts";
import { drawTextRows } from "./text_children.ts";

/** Public interface describing a radio Option. */
export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Options for configuring radio Group. */
export interface RadioGroupOptions extends ComponentOptions {
  options: RadioOption[] | Signal<RadioOption[]>;
  selectedValue?: string | undefined | Signal<string> | Signal<string | undefined>;
  activeIndex?: number | Signal<number>;
  controller?: RadioGroupController;
  onChange?: (option: RadioOption) => void | Promise<void>;
}

/** Options for configuring radio Group Controller. */
export interface RadioGroupControllerOptions {
  options: RadioOption[] | Signal<RadioOption[]>;
  selectedValue?: string | undefined | Signal<string> | Signal<string | undefined>;
  activeIndex?: number | Signal<number>;
  onChange?: (option: RadioOption) => void | Promise<void>;
}

/** Serializable inspection snapshot for radio Group. */
export interface RadioGroupInspection {
  options: RadioOption[];
  optionCount: number;
  activeIndex: number;
  active?: RadioOption;
  selectedValue?: string;
  selected?: RadioOption;
  empty: boolean;
}

/** Renders radio Group Rows into deterministic text rows. */
export function renderRadioGroupRows(
  options: readonly RadioOption[],
  selectedValue: string | undefined,
  activeIndex: number,
  height: number,
): string[] {
  const visible = visibleRadioOptions(options, activeIndex, height);
  const rows = new Array<string>(visible.length);
  for (let index = 0; index < visible.length; index += 1) {
    const row = visible[index]!;
    const selected = row.option.value === selectedValue;
    const cursor = row.active ? ">" : " ";
    const mark = selected ? "●" : "○";
    const label = row.option.disabled ? `(${row.option.label})` : row.option.label;
    rows[index] = `${cursor} ${mark} ${label}`;
  }
  return rows;
}

/** Public helper for visible Radio Options. */
export function visibleRadioOptions(
  options: readonly RadioOption[],
  activeIndex: number,
  height: number,
): Array<{ option: RadioOption; index: number; active: boolean }> {
  const safeHeight = Math.max(0, height);
  if (safeHeight === 0) return [];
  const active = clampRadioIndex(options, activeIndex);
  const offset = Math.max(0, Math.min(active - Math.floor(safeHeight / 2), Math.max(0, options.length - safeHeight)));
  const count = Math.max(0, Math.min(options.length, offset + safeHeight) - offset);
  const rows = new Array<{ option: RadioOption; index: number; active: boolean }>(count);
  for (let index = 0; index < count; index += 1) {
    const optionIndex = offset + index;
    const option = options[optionIndex]!;
    rows[index] = {
      option,
      index: optionIndex,
      active: optionIndex === active && !option.disabled,
    };
  }
  return rows;
}

/** Clamps radio Index to its valid range. */
export function clampRadioIndex(options: readonly RadioOption[], activeIndex: number): number {
  return clampActiveItemIndex(options, activeIndex, BOUNDED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Moves radio Index by a relative offset. */
export function shiftRadioIndex(options: readonly RadioOption[], activeIndex: number, delta: number): number {
  return shiftActiveItemIndex(options, activeIndex, delta, BOUNDED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Public helper for option For Value. */
export function optionForValue(options: readonly RadioOption[], value: string | undefined): RadioOption | undefined {
  for (const option of options) {
    if (option.value === value) return option;
  }
  return undefined;
}

/** State controller for radio Group behavior. */
export class RadioGroupController extends ActiveItemController<RadioOption> {
  readonly options: Signal<RadioOption[]>;
  readonly selectedValue: Signal<string | undefined>;
  readonly #ownsSelectedValue: boolean;
  readonly #onChange?: (option: RadioOption) => void | Promise<void>;

  constructor(options: RadioGroupControllerOptions) {
    super({
      items: options.options,
      activeIndex: options.activeIndex,
      policy: BOUNDED_ACTIVE_ITEM_INDEX_POLICY,
    });
    this.options = this.activeItems;
    this.#ownsSelectedValue = !(options.selectedValue instanceof Signal);
    this.selectedValue = options.selectedValue instanceof Signal
      ? options.selectedValue as Signal<string | undefined>
      : signalify(options.selectedValue);
    this.#onChange = options.onChange;
  }

  selected(): RadioOption | undefined {
    return optionForValue(this.options.peek(), this.selectedValue.peek());
  }

  selectActive(): RadioOption | undefined {
    const option = this.active();
    if (option) {
      this.selectedValue.value = option.value;
      void this.#onChange?.(option);
    }
    return option;
  }

  selectIndex(index: number): RadioOption | undefined {
    this.activeIndex.value = clampRadioIndex(this.options.peek(), index);
    return this.selectActive();
  }

  selectValue(value: string | undefined): RadioOption | undefined {
    const index = radioOptionIndexForValue(this.options.peek(), value);
    if (index < 0) return undefined;
    const option = this.options.peek()[index];
    if (!option || option.disabled) return undefined;
    this.activeIndex.value = index;
    this.selectedValue.value = option.value;
    void this.#onChange?.(option);
    return option;
  }

  handleMousePress(
    event: { y: number; ctrl?: boolean; meta?: boolean; shift?: boolean },
    groupRow = 0,
    height = this.options.peek().length,
  ): RadioOption | undefined {
    if (event.ctrl || event.meta || event.shift) return undefined;
    const rowIndex = stackedRowIndexAt(event.y, groupRow, Math.max(0, height));
    if (rowIndex === undefined) return undefined;
    const visible = visibleRadioOptions(this.options.peek(), this.activeIndex.peek(), height);
    const row = visible[rowIndex];
    if (!row || row.option.disabled) return undefined;
    return this.selectIndex(row.index);
  }

  inspect(): RadioGroupInspection {
    const options = cloneActiveItems(this.options.peek());
    const activeIndex = clampRadioIndex(options, this.activeIndex.peek());
    const active = options[activeIndex];
    const selected = optionForValue(options, this.selectedValue.peek());
    return {
      options,
      optionCount: options.length,
      activeIndex,
      active: active && !active.disabled ? { ...active } : undefined,
      selectedValue: this.selectedValue.peek(),
      selected: selected ? { ...selected } : undefined,
      empty: options.length === 0,
    };
  }

  override dispose(): void {
    super.dispose();
    if (this.#ownsSelectedValue) this.selectedValue.dispose();
  }

  protected override keyAxis(): "vertical" {
    return "vertical";
  }

  protected override selectsOnKeyPress(): boolean {
    return true;
  }

  protected override selectActiveFromKey(): void {
    this.selectActive();
  }

  protected override afterKeyPress(): void {
    this.activeIndex.value = this.clampIndex(this.activeIndex.peek());
  }
}

function radioOptionIndexForValue(options: readonly RadioOption[], value: string | undefined): number {
  for (let index = 0; index < options.length; index += 1) {
    if (options[index]!.value === value) return index;
  }
  return -1;
}

/** Public class implementing a radio Group. */
export class RadioGroup extends Component {
  options: Signal<RadioOption[]>;
  selectedValue: Signal<string | undefined>;
  activeIndex: Signal<number>;
  readonly controller: RadioGroupController;
  readonly #rows: Computed<string[]>;

  constructor(groupOptions: RadioGroupOptions) {
    super(groupOptions);
    const ownsController = !groupOptions.controller;
    this.controller = groupOptions.controller ??
      new RadioGroupController({
        options: groupOptions.options,
        selectedValue: groupOptions.selectedValue,
        activeIndex: groupOptions.activeIndex,
        onChange: groupOptions.onChange,
      });
    this.options = this.controller.options;
    this.selectedValue = this.controller.selectedValue;
    this.activeIndex = this.controller.activeIndex;
    this.#rows = new Computed(() =>
      renderRadioGroupRows(
        this.options.value,
        this.selectedValue.value,
        this.activeIndex.value,
        this.rectangle.value.height,
      )
    );

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    this.on("mousePress", (event) => {
      if (event.drag || event.release) return;
      this.controller.handleMousePress(event, this.rectangle.peek().row, this.rectangle.peek().height);
    });
    this.on("destroy", () => this.#rows.dispose());
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  active(): RadioOption | undefined {
    return this.controller.active();
  }

  selected(): RadioOption | undefined {
    return this.controller.selected();
  }

  selectActive(): RadioOption | undefined {
    return this.controller.selectActive();
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#rows);
  }
}
