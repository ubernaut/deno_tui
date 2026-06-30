// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { stackedRowIndexAt } from "./interaction.ts";
import { Text } from "./text.ts";

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
  return visibleRadioOptions(options, activeIndex, height).map((row) => {
    const selected = row.option.value === selectedValue;
    const cursor = row.active ? ">" : " ";
    const mark = selected ? "●" : "○";
    const label = row.option.disabled ? `(${row.option.label})` : row.option.label;
    return `${cursor} ${mark} ${label}`;
  });
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
  return options.slice(offset, offset + safeHeight).map((option, index) => {
    const optionIndex = offset + index;
    return {
      option,
      index: optionIndex,
      active: optionIndex === active && !option.disabled,
    };
  });
}

/** Clamps radio Index to its valid range. */
export function clampRadioIndex(options: readonly RadioOption[], activeIndex: number): number {
  if (options.length === 0) return 0;
  const clamped = Math.max(0, Math.min(activeIndex, options.length - 1));
  if (!options[clamped]?.disabled) return clamped;
  const next = shiftRadioIndex(options, clamped, 1);
  if (!options[next]?.disabled) return next;
  const previous = shiftRadioIndex(options, clamped, -1);
  return options[previous]?.disabled ? clamped : previous;
}

/** Moves radio Index by a relative offset. */
export function shiftRadioIndex(options: readonly RadioOption[], activeIndex: number, delta: number): number {
  if (options.length === 0) return 0;
  let next = Math.max(0, Math.min(activeIndex, options.length - 1));
  for (let count = 0; count < options.length; count += 1) {
    next = Math.max(0, Math.min(options.length - 1, next + delta));
    if (!options[next]?.disabled) return next;
    if (next === 0 || next === options.length - 1) break;
  }
  return activeIndex;
}

/** Public helper for option For Value. */
export function optionForValue(options: readonly RadioOption[], value: string | undefined): RadioOption | undefined {
  return options.find((option) => option.value === value);
}

/** State controller for radio Group behavior. */
export class RadioGroupController {
  readonly options: Signal<RadioOption[]>;
  readonly selectedValue: Signal<string | undefined>;
  readonly activeIndex: Signal<number>;
  readonly #ownsOptions: boolean;
  readonly #ownsSelectedValue: boolean;
  readonly #ownsActiveIndex: boolean;
  readonly #onChange?: (option: RadioOption) => void | Promise<void>;

  constructor(options: RadioGroupControllerOptions) {
    this.#ownsOptions = !(options.options instanceof Signal);
    this.#ownsSelectedValue = !(options.selectedValue instanceof Signal);
    this.#ownsActiveIndex = !(options.activeIndex instanceof Signal);
    this.options = signalify(options.options, { deepObserve: true });
    this.selectedValue = options.selectedValue instanceof Signal
      ? options.selectedValue as Signal<string | undefined>
      : signalify(options.selectedValue);
    this.activeIndex = signalify(options.activeIndex ?? 0);
    this.#onChange = options.onChange;
    this.activeIndex.value = clampRadioIndex(this.options.peek(), this.activeIndex.peek());
  }

  active(): RadioOption | undefined {
    const option = this.options.peek()[clampRadioIndex(this.options.peek(), this.activeIndex.peek())];
    return option?.disabled ? undefined : option;
  }

  selected(): RadioOption | undefined {
    return optionForValue(this.options.peek(), this.selectedValue.peek());
  }

  move(delta: number): RadioOption | undefined {
    return this.setActive(shiftRadioIndex(this.options.peek(), this.activeIndex.peek(), delta));
  }

  first(): RadioOption | undefined {
    return this.setActive(0);
  }

  last(): RadioOption | undefined {
    return this.setActive(this.options.peek().length - 1);
  }

  setActive(index: number): RadioOption | undefined {
    const next = clampRadioIndex(this.options.peek(), index);
    this.activeIndex.value = next;
    return this.active();
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
    const index = this.options.peek().findIndex((option) => option.value === value);
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

  handleKeyPress({ key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
    if (ctrl || meta || shift) return;
    if (key === "up") {
      this.move(-1);
    } else if (key === "down") {
      this.move(1);
    } else if (key === "home") {
      this.first();
    } else if (key === "end") {
      this.last();
    } else if (key === "return" || key === "space") {
      this.selectActive();
    }
    this.activeIndex.value = clampRadioIndex(this.options.peek(), this.activeIndex.peek());
  }

  inspect(): RadioGroupInspection {
    const options = this.options.peek().map((option) => ({ ...option }));
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

  dispose(): void {
    if (this.#ownsOptions) this.options.dispose();
    if (this.#ownsSelectedValue) this.selectedValue.dispose();
    if (this.#ownsActiveIndex) this.activeIndex.dispose();
  }
}

/** Public class implementing a radio Group. */
export class RadioGroup extends Component {
  options: Signal<RadioOption[]>;
  selectedValue: Signal<string | undefined>;
  activeIndex: Signal<number>;
  readonly controller: RadioGroupController;

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

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    this.on("mousePress", (event) => {
      if (event.drag || event.release) return;
      this.controller.handleMousePress(event, this.rectangle.peek().row, this.rectangle.peek().height);
    });
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
    const rows = new Computed(() =>
      renderRadioGroupRows(
        this.options.value,
        this.selectedValue.value,
        this.activeIndex.value,
        this.rectangle.value.height,
      )
    );
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const row = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => rows.value[index] ?? ""),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => ({
          column: this.rectangle.value.column,
          row: this.rectangle.value.row + index,
          width: this.rectangle.value.width,
        })),
        visible: this.visible,
      });
      row.subComponentOf = this;
      this.subComponents[`row-${index}`] = row;
    });
  }
}
