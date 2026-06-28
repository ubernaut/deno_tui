// Copyright 2023 Im-Beast. MIT license.
import { ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Button } from "./button.ts";

export enum Mark {
  Check = "✓",
  Cross = "✗",
}

export interface CheckBoxOptions extends ComponentOptions {
  checked: boolean | Signal<boolean>;
  controller?: CheckBoxController;
  onChange?: (checked: boolean) => void | Promise<void>;
}

export interface CheckBoxControllerOptions {
  checked: boolean | Signal<boolean>;
  onChange?: (checked: boolean) => void | Promise<void>;
}

export interface CheckBoxInspection {
  checked: boolean;
  mark: Mark;
}

export function renderCheckBoxMark(checked: boolean): Mark {
  return checked ? Mark.Check : Mark.Cross;
}

export class CheckBoxController {
  readonly checked: Signal<boolean>;
  readonly #ownsChecked: boolean;
  readonly #onChange?: (checked: boolean) => void | Promise<void>;

  constructor(options: CheckBoxControllerOptions) {
    this.#ownsChecked = !(options.checked instanceof Signal);
    this.checked = signalify(options.checked);
    this.#onChange = options.onChange;
  }

  setChecked(checked: boolean): boolean {
    this.checked.value = checked;
    void this.#onChange?.(checked);
    return checked;
  }

  check(): boolean {
    return this.setChecked(true);
  }

  uncheck(): boolean {
    return this.setChecked(false);
  }

  toggle(): boolean {
    return this.setChecked(!this.checked.peek());
  }

  inspect(): CheckBoxInspection {
    const checked = this.checked.peek();
    return {
      checked,
      mark: renderCheckBoxMark(checked),
    };
  }

  dispose(): void {
    if (this.#ownsChecked) this.checked.dispose();
  }
}

/**
 * Component for creating interactive checkbox
 *
 * @example
 * ```ts
 * new CheckBox({
 *  parent: tui,
 *  checked: false,
 *  theme: {
 *    base: crayon.bgGreen,
 *    focused: crayon.bgLightGreen,
 *    active: crayon.bgYellow,
 *  },
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    height: 1,
 *    width: 1,
 *  },
 *  zIndex: 0,
 * });
 * ```
 */
export class CheckBox extends Button {
  checked: Signal<boolean>;
  readonly controller: CheckBoxController;

  constructor(options: CheckBoxOptions) {
    const ownsController = !options.controller;
    const controller = options.controller ??
      new CheckBoxController({
        checked: options.checked,
        onChange: options.onChange,
      });

    Object.assign(options, {
      label: {
        text: new Computed(() => renderCheckBoxMark(controller.checked.value)),
      },
    });

    super(options);
    this.controller = controller;
    this.checked = controller.checked;
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override interact(method: "mouse" | "keyboard"): void {
    super.interact(method);
    if (this.state.peek() === "active") this.controller.toggle();
  }
}
