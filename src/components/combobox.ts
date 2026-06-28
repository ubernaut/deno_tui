// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal, SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Button, ButtonOptions } from "./button.ts";

export interface ComboBoxOptions<Items extends string[] = string[]> extends Omit<ButtonOptions, "label"> {
  placeholder?: string;
  items: Items | SignalOfObject<Items>;
  selectedItem?: number | undefined | Signal<number | undefined>;
  expanded?: boolean | Signal<boolean>;
  controller?: ComboBoxController<Items>;
  onSelect?: (item: Items[number], index: number) => void | Promise<void>;
  onExpandedChange?: (expanded: boolean) => void | Promise<void>;
}

export interface ComboBoxControllerOptions<Items extends string[] = string[]> {
  placeholder?: string | Signal<string>;
  items: Items | SignalOfObject<Items>;
  selectedIndex?: number | undefined | Signal<number | undefined>;
  expanded?: boolean | Signal<boolean>;
  onSelect?: (item: Items[number], index: number) => void | Promise<void>;
  onExpandedChange?: (expanded: boolean) => void | Promise<void>;
}

export interface ComboBoxInspection {
  items: string[];
  itemCount: number;
  selectedIndex?: number;
  selected?: string;
  expanded: boolean;
  placeholder: string;
  label: string;
  empty: boolean;
}

export function clampComboBoxIndex(items: readonly string[], index: number | undefined): number | undefined {
  if (items.length === 0 || index === undefined || !Number.isFinite(index)) return undefined;
  return Math.max(0, Math.min(Math.floor(index), items.length - 1));
}

export function comboBoxLabel(
  items: readonly string[],
  selectedIndex: number | undefined,
  placeholder = "",
): string {
  const selected = clampComboBoxIndex(items, selectedIndex);
  return selected === undefined ? placeholder : items[selected] ?? placeholder;
}

export class ComboBoxController<Items extends string[] = string[]> {
  readonly items: Signal<Items>;
  readonly selectedIndex: Signal<number | undefined>;
  readonly expanded: Signal<boolean>;
  readonly placeholder: Signal<string>;
  readonly #ownsItems: boolean;
  readonly #ownsSelectedIndex: boolean;
  readonly #ownsExpanded: boolean;
  readonly #ownsPlaceholder: boolean;
  readonly #onSelect?: (item: Items[number], index: number) => void | Promise<void>;
  readonly #onExpandedChange?: (expanded: boolean) => void | Promise<void>;
  readonly #syncSelection = () => {
    this.selectedIndex.value = clampComboBoxIndex(this.items.peek(), this.selectedIndex.peek());
    if (this.items.peek().length === 0) this.setExpanded(false);
  };

  constructor(options: ComboBoxControllerOptions<Items>) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsSelectedIndex = !(options.selectedIndex instanceof Signal);
    this.#ownsExpanded = !(options.expanded instanceof Signal);
    this.#ownsPlaceholder = !(options.placeholder instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex);
    this.expanded = signalify(options.expanded ?? false);
    this.placeholder = signalify(options.placeholder ?? "");
    this.#onSelect = options.onSelect;
    this.#onExpandedChange = options.onExpandedChange;
    this.items.subscribe(this.#syncSelection);
    this.#syncSelection();
  }

  label(): string {
    return comboBoxLabel(this.items.peek(), this.selectedIndex.peek(), this.placeholder.peek());
  }

  selected(): Items[number] | undefined {
    const index = clampComboBoxIndex(this.items.peek(), this.selectedIndex.peek());
    return index === undefined ? undefined : this.items.peek()[index];
  }

  setExpanded(expanded: boolean): boolean {
    const next = expanded && this.items.peek().length > 0;
    if (this.expanded.peek() !== next) {
      this.expanded.value = next;
      void this.#onExpandedChange?.(next);
    }
    return this.expanded.peek();
  }

  open(): boolean {
    return this.setExpanded(true);
  }

  close(): boolean {
    return this.setExpanded(false);
  }

  toggle(): boolean {
    return this.setExpanded(!this.expanded.peek());
  }

  move(delta: number): Items[number] | undefined {
    const items = this.items.peek();
    if (items.length === 0) return undefined;
    const current = clampComboBoxIndex(items, this.selectedIndex.peek()) ?? (delta < 0 ? items.length : -1);
    return this.setSelectedIndex(current + delta);
  }

  first(): Items[number] | undefined {
    return this.setSelectedIndex(0);
  }

  last(): Items[number] | undefined {
    return this.setSelectedIndex(this.items.peek().length - 1);
  }

  setSelectedIndex(index: number | undefined): Items[number] | undefined {
    const next = clampComboBoxIndex(this.items.peek(), index);
    this.selectedIndex.value = next;
    return this.selected();
  }

  selectActive(): Items[number] | undefined {
    const index = clampComboBoxIndex(this.items.peek(), this.selectedIndex.peek());
    if (index === undefined) return undefined;
    const item = this.items.peek()[index];
    if (item !== undefined) {
      void this.#onSelect?.(item, index);
      this.close();
    }
    return item;
  }

  selectIndex(index: number): Items[number] | undefined {
    const item = this.setSelectedIndex(index);
    if (item === undefined) return undefined;
    return this.selectActive();
  }

  handleKeyPress({ key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }) {
    if (ctrl || meta || shift) return undefined;
    if (key === "up") {
      this.open();
      return this.move(-1);
    }
    if (key === "down") {
      this.open();
      return this.move(1);
    }
    if (key === "home") {
      this.open();
      return this.first();
    }
    if (key === "end") {
      this.open();
      return this.last();
    }
    if (key === "escape") {
      this.close();
      return undefined;
    }
    if (key === "space") {
      this.toggle();
      return this.selected();
    }
    if (key === "return") {
      if (!this.expanded.peek()) {
        this.open();
        return this.selected();
      }
      return this.selectActive();
    }
    return undefined;
  }

  inspect(): ComboBoxInspection {
    const items = [...this.items.peek()];
    const selectedIndex = clampComboBoxIndex(items, this.selectedIndex.peek());
    return {
      items,
      itemCount: items.length,
      selectedIndex,
      selected: selectedIndex === undefined ? undefined : items[selectedIndex],
      expanded: this.expanded.peek(),
      placeholder: this.placeholder.peek(),
      label: comboBoxLabel(items, selectedIndex, this.placeholder.peek()),
      empty: items.length === 0,
    };
  }

  dispose(): void {
    this.items.unsubscribe(this.#syncSelection);
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsSelectedIndex) this.selectedIndex.dispose();
    if (this.#ownsExpanded) this.expanded.dispose();
    if (this.#ownsPlaceholder) this.placeholder.dispose();
  }
}

/**
 * Component for creating interactive combobox
 *
 * @example
 * ```ts
 * new ComboBox({
 *  parent: tui,
 *  items: ["one", "two", "three", "four"],
 *  placeholder: "choose number",
 *  theme: {
 *    base: crayon.bgGreen,
 *    focused: crayon.bgLightGreen,
 *    active: crayon.bgYellow,
 *  },
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    height: 1,
 *    width: 14,
 *  },
 *  zIndex: 0,
 * });
 * ```
 */
export class ComboBox<Items extends string[] = string[]> extends Button {
  declare subComponents: { [button: number]: Button };
  #subComponentsLength: number;

  items: Signal<Items>;
  expanded: Signal<boolean>;
  selectedItem: Signal<number | undefined>;
  placeholder: Signal<string>;
  readonly controller: ComboBoxController<Items>;

  constructor(options: ComboBoxOptions<Items>) {
    const ownsController = !options.controller;
    const controller = options.controller ??
      new ComboBoxController({
        items: options.items,
        selectedIndex: options.selectedItem,
        expanded: options.expanded,
        placeholder: options.placeholder ?? "",
        onSelect: options.onSelect,
        onExpandedChange: options.onExpandedChange,
      });

    Object.assign(options, {
      label: {
        text: new Computed(() => {
          controller.items.value;
          controller.selectedIndex.value;
          controller.placeholder.value;
          return controller.label();
        }),
      },
    });

    super(options);

    this.controller = controller as ComboBoxController<Items>;
    this.items = this.controller.items;
    this.expanded = this.controller.expanded;
    this.placeholder = this.controller.placeholder;
    this.selectedItem = this.controller.selectedIndex;

    this.#subComponentsLength = this.items.value.length;
    this.#updateItemButtons();

    this.items.subscribe((items) => {
      this.#updateItemButtons();
      this.#subComponentsLength = items.length;
    });
    this.on("keyPress", (event) => {
      this.controller.handleKeyPress(event);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  #updateItemButtons(): void {
    const { subComponents } = this;
    const items = this.items.peek();

    for (let i = 0; i < Math.max(items.length, this.#subComponentsLength); ++i) {
      const subComponent = subComponents[i];
      if (subComponent) {
        if (i >= items.length) {
          subComponent.destroy();
          delete subComponents[i];
        }
        continue;
      }

      const buttonRectangle = { column: 0, row: 0, width: 0, height: 0 };

      const button = new Button({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        visible: this.expanded,
        label: {
          text: new Computed(() => this.items.value[i]),
        },
        rectangle: new Computed(() => {
          const { column, row, width, height } = this.rectangle.value;
          buttonRectangle.column = column;
          buttonRectangle.row = row + (i + 1) * height;
          buttonRectangle.width = width;
          buttonRectangle.height = height;
          return buttonRectangle;
        }),
      });

      button.state.when("active", () => {
        this.controller.selectIndex(i);
      });

      subComponents[i] = button;
    }
  }

  override interact(method: "mouse" | "keyboard"): void {
    super.interact(method);

    if (this.state.peek() === "active") {
      this.controller.toggle();
    }
  }
}
