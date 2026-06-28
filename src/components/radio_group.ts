// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupOptions extends ComponentOptions {
  options: RadioOption[] | Signal<RadioOption[]>;
  selectedValue?: string | undefined | Signal<string> | Signal<string | undefined>;
  activeIndex?: number | Signal<number>;
  onChange?: (option: RadioOption) => void | Promise<void>;
}

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

export function clampRadioIndex(options: readonly RadioOption[], activeIndex: number): number {
  if (options.length === 0) return 0;
  const clamped = Math.max(0, Math.min(activeIndex, options.length - 1));
  if (!options[clamped]?.disabled) return clamped;
  const next = shiftRadioIndex(options, clamped, 1);
  if (!options[next]?.disabled) return next;
  const previous = shiftRadioIndex(options, clamped, -1);
  return options[previous]?.disabled ? clamped : previous;
}

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

export function optionForValue(options: readonly RadioOption[], value: string | undefined): RadioOption | undefined {
  return options.find((option) => option.value === value);
}

export class RadioGroup extends Component {
  options: Signal<RadioOption[]>;
  selectedValue: Signal<string | undefined>;
  activeIndex: Signal<number>;

  constructor(private readonly groupOptions: RadioGroupOptions) {
    super(groupOptions);
    this.options = signalify(groupOptions.options, { deepObserve: true });
    this.selectedValue = groupOptions.selectedValue instanceof Signal
      ? groupOptions.selectedValue as Signal<string | undefined>
      : signalify(groupOptions.selectedValue);
    this.activeIndex = signalify(groupOptions.activeIndex ?? 0);

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta || shift) return;
      if (key === "up") {
        this.activeIndex.value = shiftRadioIndex(this.options.peek(), this.activeIndex.peek(), -1);
      } else if (key === "down") {
        this.activeIndex.value = shiftRadioIndex(this.options.peek(), this.activeIndex.peek(), 1);
      } else if (key === "home") {
        this.activeIndex.value = clampRadioIndex(this.options.peek(), 0);
      } else if (key === "end") {
        this.activeIndex.value = clampRadioIndex(this.options.peek(), this.options.peek().length - 1);
      } else if (key === "return" || key === "space") {
        const option = this.active();
        if (option) {
          this.selectedValue.value = option.value;
          void this.groupOptions.onChange?.(option);
        }
      }
      this.activeIndex.value = clampRadioIndex(this.options.peek(), this.activeIndex.peek());
    });
  }

  active(): RadioOption | undefined {
    const option = this.options.peek()[clampRadioIndex(this.options.peek(), this.activeIndex.peek())];
    return option?.disabled ? undefined : option;
  }

  selected(): RadioOption | undefined {
    return optionForValue(this.options.peek(), this.selectedValue.peek());
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
