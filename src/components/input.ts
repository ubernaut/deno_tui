// Copyright 2023 Im-Beast. MIT license.
import { Box } from "./box.ts";

import { Theme } from "../theme.ts";
import { DeepPartial } from "../types.ts";
import { ComponentOptions } from "../component.ts";

import { Computed, Signal, SignalOfObject } from "../signals/mod.ts";

import { BoxObject } from "../canvas/box.ts";
import { TextObject, TextRectangle } from "../canvas/text.ts";

import { clamp } from "../utils/numbers.ts";
import { signalify } from "../utils/signals.ts";
import { cropToWidth, insertAt } from "../utils/strings.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";

/** Public interface describing an input Theme. */
export interface InputTheme extends Theme {
  value: Theme;
  cursor: Theme;
  placeholder: Theme;
}

/** Public interface describing an input Rectangle. */
export interface InputRectangle {
  column: number;
  row: number;
  width: number;
  height?: 1;
}

/** Options for configuring input. */
export interface InputOptions extends Omit<ComponentOptions, "rectangle">, InputControllerOptions {
  controller?: InputController;
  rectangle: InputRectangle | SignalOfObject<InputRectangle>;
  theme: DeepPartial<InputTheme, "cursor">;
}

/** Options for configuring input Controller. */
export interface InputControllerOptions {
  text?: string | Signal<string>;
  cursorPosition?: number | Signal<number>;
  validator?: RegExp | Signal<RegExp | undefined>;
  password?: boolean | Signal<boolean>;
  placeholder?: string | Signal<string | undefined>;
  multiCodePointSupport?: boolean | Signal<boolean>;
  onChange?: (value: string) => void | Promise<void>;
  onSubmit?: (value: string) => void | Promise<void>;
}

/** Serializable inspection snapshot for input. */
export interface InputInspection {
  text: string;
  cursorPosition: number;
  length: number;
  empty: boolean;
  password: boolean;
  placeholder?: string;
  valid: boolean;
}

/** Public type alias for an input Edit Result. */
export type InputEditResult =
  | "changed"
  | "submitted"
  | "moved"
  | "ignored";

/** State controller for input behavior. */
export class InputController {
  readonly text: Signal<string>;
  readonly cursorPosition: Signal<number>;
  readonly validator: Signal<RegExp | undefined>;
  readonly password: Signal<boolean>;
  readonly placeholder: Signal<string | undefined>;
  readonly multiCodePointSupport: Signal<boolean>;
  readonly #ownsText: boolean;
  readonly #ownsCursorPosition: boolean;
  readonly #ownsValidator: boolean;
  readonly #ownsPassword: boolean;
  readonly #ownsPlaceholder: boolean;
  readonly #ownsMultiCodePointSupport: boolean;
  readonly #onChange?: (value: string) => void | Promise<void>;
  readonly #onSubmit?: (value: string) => void | Promise<void>;
  readonly #syncCursor = () => {
    this.cursorPosition.value = clamp(this.cursorPosition.peek(), 0, this.text.peek().length);
  };

  constructor(options: InputControllerOptions = {}) {
    this.#ownsText = !(options.text instanceof Signal);
    this.#ownsCursorPosition = !(options.cursorPosition instanceof Signal);
    this.#ownsValidator = !(options.validator instanceof Signal);
    this.#ownsPassword = !(options.password instanceof Signal);
    this.#ownsPlaceholder = !(options.placeholder instanceof Signal);
    this.#ownsMultiCodePointSupport = !(options.multiCodePointSupport instanceof Signal);
    this.text = signalify(options.text ?? "");
    this.cursorPosition = signalify(options.cursorPosition ?? 0);
    this.validator = signalify(options.validator);
    this.password = signalify(options.password ?? false);
    this.placeholder = signalify(options.placeholder);
    this.multiCodePointSupport = signalify(options.multiCodePointSupport ?? false);
    this.#onChange = options.onChange;
    this.#onSubmit = options.onSubmit;
    this.text.subscribe(this.#syncCursor);
    this.cursorPosition.subscribe(this.#syncCursor);
    this.#syncCursor();
  }

  setText(value: string, cursorPosition = value.length): string {
    this.text.value = value;
    this.cursorPosition.value = clamp(cursorPosition, 0, value.length);
    void this.#onChange?.(this.text.peek());
    return this.text.peek();
  }

  clear(): string {
    return this.setText("", 0);
  }

  moveCursor(offset: number): number {
    return this.setCursorPosition(this.cursorPosition.peek() + offset);
  }

  setCursorPosition(position: number): number {
    this.cursorPosition.value = clamp(position, 0, this.text.peek().length);
    return this.cursorPosition.peek();
  }

  home(): number {
    return this.setCursorPosition(0);
  }

  end(): number {
    return this.setCursorPosition(this.text.peek().length);
  }

  insert(character: string): boolean {
    if (!this.accepts(character)) return false;
    const cursorPosition = this.cursorPosition.peek();
    const value = insertAt(this.text.peek(), cursorPosition, character);
    this.setText(value, cursorPosition + character.length);
    return true;
  }

  backspace(): boolean {
    const cursorPosition = this.cursorPosition.peek();
    if (cursorPosition === 0) return false;
    const value = this.text.peek();
    this.setText(value.slice(0, cursorPosition - 1) + value.slice(cursorPosition), cursorPosition - 1);
    return true;
  }

  delete(): boolean {
    const cursorPosition = this.cursorPosition.peek();
    const value = this.text.peek();
    if (cursorPosition >= value.length) return false;
    this.setText(value.slice(0, cursorPosition) + value.slice(cursorPosition + 1), cursorPosition);
    return true;
  }

  submit(): string {
    const value = this.text.peek();
    void this.#onSubmit?.(value);
    return value;
  }

  handleKeyPress({ key, ctrl, meta }: Pick<KeyPressEvent, "key" | "ctrl" | "meta">): InputEditResult {
    if (ctrl || meta) return "ignored";

    switch (key) {
      case "return":
        this.submit();
        return "submitted";
      case "backspace":
        return this.backspace() ? "changed" : "ignored";
      case "delete":
        return this.delete() ? "changed" : "ignored";
      case "left":
        this.moveCursor(-1);
        return "moved";
      case "right":
        this.moveCursor(1);
        return "moved";
      case "home":
        this.home();
        return "moved";
      case "end":
        this.end();
        return "moved";
      case "space":
        return this.insert(" ") ? "changed" : "ignored";
      case "tab":
        return this.insert("\t") ? "changed" : "ignored";
      default:
        if (key.length > 1) return "ignored";
        return this.insert(key) ? "changed" : "ignored";
    }
  }

  accepts(character: string): boolean {
    const validator = this.validator.peek();
    if (!validator) return true;
    validator.lastIndex = 0;
    return validator.test(character);
  }

  inspect(): InputInspection {
    const text = this.text.peek();
    const validator = this.validator.peek();
    if (validator) validator.lastIndex = 0;
    return {
      text,
      cursorPosition: this.cursorPosition.peek(),
      length: text.length,
      empty: text.length === 0,
      password: this.password.peek(),
      placeholder: this.placeholder.peek(),
      valid: validator
        ? [...text].every((character) => {
          validator.lastIndex = 0;
          return validator.test(character);
        })
        : true,
    };
  }

  dispose(): void {
    this.text.unsubscribe(this.#syncCursor);
    this.cursorPosition.unsubscribe(this.#syncCursor);
    if (this.#ownsText) this.text.dispose();
    if (this.#ownsCursorPosition) this.cursorPosition.dispose();
    if (this.#ownsValidator) this.validator.dispose();
    if (this.#ownsPassword) this.password.dispose();
    if (this.#ownsPlaceholder) this.placeholder.dispose();
    if (this.#ownsMultiCodePointSupport) this.multiCodePointSupport.dispose();
  }
}

/**
 * Component for creating interactive text input
 *
 * This component is 1 character high only!
 *
 * If you need multiline input use `TextBox` component.
 *
 * @example
 * ```ts
 * new Input({
 *  parent: tui,
 *  placeholder: "type here",
 *  theme: {
 *    base: crayon.bgGreen,
 *    focused: crayon.bgLightGreen,
 *    active: crayon.bgYellow,
 *  },
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    width: 10,
 *  },
 *  zIndex: 0,
 * });
 * ```
 *
 * It supports validating input, e.g. number input would look like this:
 * @example
 * ```ts
 * new Input({
 *  ...,
 *  validator: /\d+/,
 * });
 * ```
 *
 * You can also define whether text should be censored with `*` character by specifying `password` property.
 * @example
 * ```ts
 * new Input({
 *  ...,
 *  password: true,
 * });
 * ```
 *
 * If you need to use emojis or other multi codepoint characters set `multiCodePointSupport` property to true.
 * @example
 * ```ts
 * new Input({
 *  ...,
 *  placeholder: "🧡",
 *  multiCodePointCharacter: true,
 * });
 * ```
 */
export class Input extends Box {
  declare drawnObjects: {
    box: BoxObject;
    text: TextObject;
    cursor: TextObject;
  };
  declare theme: InputTheme;

  text: Signal<string>;
  password: Signal<boolean>;
  cursorPosition: Signal<number>;
  validator: Signal<RegExp | undefined>;
  multiCodePointSupport: Signal<boolean>;
  placeholder: Signal<string | undefined>;
  readonly controller: InputController;

  constructor(options: InputOptions) {
    const { rectangle } = options;

    if ("value" in rectangle) {
      rectangle.value.height = 1;
    } else {
      rectangle.height = 1;
    }

    super(options as ComponentOptions);

    this.theme.value ??= this.theme;
    this.theme.placeholder ??= this.theme.value;

    const ownsController = !options.controller;
    const controller = options.controller ??
      new InputController({
        text: options.text,
        cursorPosition: options.cursorPosition,
        validator: options.validator,
        placeholder: options.placeholder,
        password: options.password,
        multiCodePointSupport: options.multiCodePointSupport,
        onChange: options.onChange,
        onSubmit: options.onSubmit,
      });
    this.controller = controller;
    this.cursorPosition = controller.cursorPosition;
    this.text = controller.text;
    this.validator = controller.validator;
    this.placeholder = controller.placeholder;
    this.password = controller.password;
    this.multiCodePointSupport = controller.multiCodePointSupport;

    this.on("keyPress", (event) => {
      this.controller.handleKeyPress(event);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();

    const { canvas } = this.tui;

    const textRectangle: TextRectangle = { column: 0, row: 0, width: 0 };
    const text = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      multiCodePointSupport: this.multiCodePointSupport,
      style: new Computed(() =>
        this.theme[!this.text.value && this.placeholder ? "placeholder" : "value"][this.state.value]
      ),
      value: new Computed(() => {
        const password = this.password.value;
        const placeholder = this.placeholder.value;
        const cursorPosition = this.cursorPosition.value;
        const value = this.text.value.replace("\t", " ");
        const { width } = this.rectangle.value;

        if (!value && placeholder) {
          return cropToWidth(placeholder, width);
        }

        const offsetX = cursorPosition - width + 1;
        return password
          ? "*".repeat(Math.min(value.length, width))
          : cropToWidth(offsetX > 0 ? value.slice(offsetX, cursorPosition) : value, width);
      }),
      rectangle: new Computed(() => {
        const { row, column } = this.rectangle.value;
        textRectangle.column = column;
        textRectangle.row = row;
        return textRectangle;
      }),
    });

    const cursorRectangle: TextRectangle = { column: 0, row: 0, width: 1 };
    const cursor = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      multiCodePointSupport: this.multiCodePointSupport,
      value: new Computed(() => {
        const value = this.text.value;
        const placeholder = this.placeholder.value;
        const cursorPosition = this.cursorPosition.value;
        return (value ? value[cursorPosition] : placeholder?.[cursorPosition]) ?? " ";
      }),
      style: new Computed(() => this.theme.cursor[this.state.value]),
      rectangle: new Computed(() => {
        const cursorPosition = this.cursorPosition.value;
        const { row, column, width } = this.rectangle.value;
        cursorRectangle.column = column + Math.min(cursorPosition, width - 1);
        cursorRectangle.row = row;
        return cursorRectangle;
      }),
    });

    this.drawnObjects.text = text;
    this.drawnObjects.cursor = cursor;

    text.draw();
    cursor.draw();
  }

  override interact(method: "keyboard" | "mouse"): void {
    this.state.value = this.nextInteractionState(method);
    super.interact(method);
  }
}
