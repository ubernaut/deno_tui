// Copyright 2023 Im-Beast. MIT license.
import { Box } from "./box.ts";
import { ComponentOptions } from "../component.ts";

import { BoxObject } from "../canvas/box.ts";
import { TextObject, TextRectangle } from "../canvas/text.ts";
import { Theme } from "../theme.ts";
import { DeepPartial } from "../types.ts";
import { cropToWidth, insertAt } from "../utils/strings.ts";
import { clamp } from "../utils/numbers.ts";
import { Computed, Effect, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { KeyPressEvent } from "../input_reader/types.ts";

/** Public interface describing a cursor Position. */
export interface CursorPosition {
  x: number;
  y: number;
}

/** Public interface describing a text Box Theme. */
export interface TextBoxTheme extends Theme {
  value: Theme;
  cursor: Theme;
  /** Style for numbers counting textbox rows */
  lineNumbers: Theme;
  /** Style for currently selected text row */
  highlightedLine: Theme;
}

/** Options for configuring text Box. */
export interface TextBoxOptions extends ComponentOptions {
  text?: string | Signal<string>;
  validator?: RegExp | Signal<RegExp | undefined>;
  theme: DeepPartial<TextBoxTheme, "cursor">;
  multiCodePointSupport?: boolean | Signal<boolean>;
  cursorPosition?: CursorPosition | Signal<CursorPosition>;
  /** Whether to highlight currently selected text row */
  lineHighlighting?: boolean | Signal<boolean>;
  /** Whether to number textbox rows */
  lineNumbering?: boolean | Signal<boolean>;
  /** Whether long logical lines wrap into multiple visual rows */
  wordWrap?: boolean | Signal<boolean>;
  controller?: TextBoxController;
  onChange?: (value: string) => void | Promise<void>;
  /** Function that defines what key does what while textbox is focused/active */
  keyboardHandler?: (keyPress: KeyPressEvent) => void;
}

/** Options for configuring text Box Controller. */
export interface TextBoxControllerOptions {
  text?: string | Signal<string>;
  cursorPosition?: CursorPosition | Signal<CursorPosition>;
  validator?: RegExp | Signal<RegExp | undefined>;
  multiCodePointSupport?: boolean | Signal<boolean>;
  lineHighlighting?: boolean | Signal<boolean>;
  lineNumbering?: boolean | Signal<boolean>;
  wordWrap?: boolean | Signal<boolean>;
  onChange?: (value: string) => void | Promise<void>;
}

/** Serializable inspection snapshot for text Box. */
export interface TextBoxInspection {
  text: string;
  lines: readonly string[];
  lineCount: number;
  cursorPosition: CursorPosition;
  currentLine: string;
  empty: boolean;
  valid: boolean;
  lineHighlighting: boolean;
  lineNumbering: boolean;
  wordWrap: boolean;
}

/** Public type alias for a text Box Edit Result. */
export type TextBoxEditResult = "changed" | "moved" | "ignored";

/** Serializable inspection snapshot for text Line Cache. */
export interface TextLineCacheInspection {
  text: string;
  lineCount: number;
}

/** Public interface describing a text Box Visual Line. */
export interface TextBoxVisualLine {
  lineIndex: number;
  startColumn: number;
  endColumn: number;
  text: string;
  continuation: boolean;
}

/** Public interface describing a text Box Visual Cursor. */
export interface TextBoxVisualCursor {
  row: number;
  column: number;
  line: TextBoxVisualLine;
}

/** Public class implementing a text Line Cache. */
export class TextLineCache {
  #text = "";
  #lines: readonly string[] = [""];

  lines(text: string): readonly string[] {
    if (text !== this.#text) {
      this.#text = text;
      this.#lines = text.split("\n");
    }
    return this.#lines;
  }

  inspect(): TextLineCacheInspection {
    return {
      text: this.#text,
      lineCount: this.#lines.length,
    };
  }
}

/** State controller for text Box behavior. */
export class TextBoxController {
  readonly text: Signal<string>;
  readonly cursorPosition: Signal<CursorPosition>;
  readonly validator: Signal<RegExp | undefined>;
  readonly multiCodePointSupport: Signal<boolean>;
  readonly lineHighlighting: Signal<boolean>;
  readonly lineNumbering: Signal<boolean>;
  readonly wordWrap: Signal<boolean>;
  readonly lines: Computed<readonly string[]>;
  readonly #textLineCache = new TextLineCache();
  readonly #ownsText: boolean;
  readonly #ownsCursorPosition: boolean;
  readonly #ownsValidator: boolean;
  readonly #ownsMultiCodePointSupport: boolean;
  readonly #ownsLineHighlighting: boolean;
  readonly #ownsLineNumbering: boolean;
  readonly #ownsWordWrap: boolean;
  readonly #onChange?: (value: string) => void | Promise<void>;
  readonly #syncCursor = () => this.clampCursor();

  constructor(options: TextBoxControllerOptions = {}) {
    this.#ownsText = !(options.text instanceof Signal);
    this.#ownsCursorPosition = !(options.cursorPosition instanceof Signal);
    this.#ownsValidator = !(options.validator instanceof Signal);
    this.#ownsMultiCodePointSupport = !(options.multiCodePointSupport instanceof Signal);
    this.#ownsLineHighlighting = !(options.lineHighlighting instanceof Signal);
    this.#ownsLineNumbering = !(options.lineNumbering instanceof Signal);
    this.#ownsWordWrap = !(options.wordWrap instanceof Signal);
    this.text = signalify(options.text ?? "");
    this.cursorPosition = signalify(options.cursorPosition ?? { x: 0, y: 0 }, { deepObserve: true });
    this.validator = signalify(options.validator);
    this.multiCodePointSupport = signalify(options.multiCodePointSupport ?? false);
    this.lineHighlighting = signalify(options.lineHighlighting ?? false);
    this.lineNumbering = signalify(options.lineNumbering ?? false);
    this.wordWrap = signalify(options.wordWrap ?? false);
    this.#onChange = options.onChange;
    this.lines = new Computed(() => this.#textLineCache.lines(this.text.value));
    this.text.subscribe(this.#syncCursor);
    this.cursorPosition.subscribe(this.#syncCursor);
    this.#syncCursor();
  }

  setText(value: string, cursorPosition: CursorPosition = this.endPosition(value)): string {
    this.text.value = value;
    this.setCursorPosition(cursorPosition);
    void this.#onChange?.(this.text.peek());
    return this.text.peek();
  }

  clear(): string {
    return this.setText("", { x: 0, y: 0 });
  }

  setCursorPosition(position: CursorPosition): CursorPosition {
    const cursor = this.cursorPosition.peek();
    cursor.y = position.y;
    cursor.x = position.x;
    this.clampCursor();
    this.cursorPosition.forceUpdateValue = true;
    this.cursorPosition.value = cursor;
    return { ...this.cursorPosition.peek() };
  }

  moveCursor(delta: Partial<CursorPosition>): CursorPosition {
    const cursor = this.cursorPosition.peek();
    return this.setCursorPosition({
      x: cursor.x + (delta.x ?? 0),
      y: cursor.y + (delta.y ?? 0),
    });
  }

  home(): CursorPosition {
    return this.setCursorPosition({ ...this.cursorPosition.peek(), x: 0 });
  }

  end(): CursorPosition {
    const cursor = this.cursorPosition.peek();
    return this.setCursorPosition({
      x: this.currentLines()[cursor.y]?.length ?? 0,
      y: cursor.y,
    });
  }

  insert(character: string): boolean {
    if (!this.accepts(character)) return false;
    const cursor = this.cursorPosition.peek();
    const lines = [...this.currentLines()];
    const line = lines[cursor.y] ?? "";
    lines[cursor.y] = insertAt(line, cursor.x, character);
    this.setText(lines.join("\n"), { x: cursor.x + character.length, y: cursor.y });
    return true;
  }

  newline(): boolean {
    const cursor = this.cursorPosition.peek();
    const lines = [...this.currentLines()];
    const line = lines[cursor.y] ?? "";
    lines[cursor.y] = line.slice(0, cursor.x);
    lines.splice(cursor.y + 1, 0, line.slice(cursor.x));
    this.setText(lines.join("\n"), { x: 0, y: cursor.y + 1 });
    return true;
  }

  backspace(): boolean {
    const cursor = this.cursorPosition.peek();
    const lines = [...this.currentLines()];
    const line = lines[cursor.y] ?? "";
    if (cursor.x === 0) {
      if (cursor.y === 0) return false;
      const previous = lines[cursor.y - 1] ?? "";
      lines[cursor.y - 1] = previous + line;
      lines.splice(cursor.y, 1);
      this.setText(lines.join("\n"), { x: previous.length, y: cursor.y - 1 });
      return true;
    }
    lines[cursor.y] = line.slice(0, cursor.x - 1) + line.slice(cursor.x);
    this.setText(lines.join("\n"), { x: cursor.x - 1, y: cursor.y });
    return true;
  }

  delete(): boolean {
    const cursor = this.cursorPosition.peek();
    const lines = [...this.currentLines()];
    const line = lines[cursor.y] ?? "";
    if (cursor.x < line.length) {
      lines[cursor.y] = line.slice(0, cursor.x) + line.slice(cursor.x + 1);
      this.setText(lines.join("\n"), cursor);
      return true;
    }
    if (lines.length - 1 <= cursor.y) return false;
    lines[cursor.y] = line + (lines[cursor.y + 1] ?? "");
    lines.splice(cursor.y + 1, 1);
    this.setText(lines.join("\n"), cursor);
    return true;
  }

  handleKeyPress({ key, ctrl, meta }: KeyPressEvent): TextBoxEditResult {
    if (ctrl || meta) return "ignored";

    switch (key) {
      case "left":
        this.moveCursor({ x: -1 });
        return "moved";
      case "right":
        this.moveCursor({ x: 1 });
        return "moved";
      case "up":
        this.moveCursor({ y: -1 });
        return "moved";
      case "down":
        this.moveCursor({ y: 1 });
        return "moved";
      case "home":
        this.home();
        return "moved";
      case "end":
        this.end();
        return "moved";
      case "backspace":
        return this.backspace() ? "changed" : "ignored";
      case "delete":
        return this.delete() ? "changed" : "ignored";
      case "return":
        return this.newline() ? "changed" : "ignored";
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

  inspect(): TextBoxInspection {
    const text = this.text.peek();
    const lines = this.currentLines();
    const validator = this.validator.peek();
    return {
      text,
      lines,
      lineCount: lines.length,
      cursorPosition: { ...this.cursorPosition.peek() },
      currentLine: lines[this.cursorPosition.peek().y] ?? "",
      empty: text.length === 0,
      valid: validator
        ? [...text].every((character) => {
          if (character === "\n") return true;
          validator.lastIndex = 0;
          return validator.test(character);
        })
        : true,
      lineHighlighting: this.lineHighlighting.peek(),
      lineNumbering: this.lineNumbering.peek(),
      wordWrap: this.wordWrap.peek(),
    };
  }

  dispose(): void {
    this.text.unsubscribe(this.#syncCursor);
    this.cursorPosition.unsubscribe(this.#syncCursor);
    try {
      this.lines.dispose();
    } catch {
      // Computed dependency tracking is asynchronous; disposal may happen before
      // dependencies have linked their dependant sets in short-lived tests.
    }
    if (this.#ownsText) this.text.dispose();
    if (this.#ownsCursorPosition) this.cursorPosition.dispose();
    if (this.#ownsValidator) this.validator.dispose();
    if (this.#ownsMultiCodePointSupport) this.multiCodePointSupport.dispose();
    if (this.#ownsLineHighlighting) this.lineHighlighting.dispose();
    if (this.#ownsLineNumbering) this.lineNumbering.dispose();
    if (this.#ownsWordWrap) this.wordWrap.dispose();
  }

  private clampCursor(): void {
    const cursor = this.cursorPosition.peek();
    const lines = this.currentLines();
    cursor.y = clamp(cursor.y, 0, Math.max(lines.length - 1, 0));
    cursor.x = clamp(cursor.x, 0, lines[cursor.y]?.length ?? 0);
  }

  private currentLines(): readonly string[] {
    return this.#textLineCache.lines(this.text.peek());
  }

  private endPosition(value: string): CursorPosition {
    const lines = this.#textLineCache.lines(value);
    const y = Math.max(lines.length - 1, 0);
    return { x: lines[y]?.length ?? 0, y };
  }
}

/** Public helper for wrap Text Box Lines. */
export function wrapTextBoxLines(
  lines: readonly string[],
  width: number,
  options: { wordWrap?: boolean } = {},
): TextBoxVisualLine[] {
  const visual: TextBoxVisualLine[] = [];
  const safeWidth = Math.max(1, Math.floor(width));
  const wordWrap = options.wordWrap ?? true;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    if (!wordWrap || line.length <= safeWidth) {
      visual.push({
        lineIndex,
        startColumn: 0,
        endColumn: line.length,
        text: cropToWidth(line.replaceAll("\t", " "), safeWidth),
        continuation: false,
      });
      continue;
    }
    if (line.length === 0) {
      visual.push({ lineIndex, startColumn: 0, endColumn: 0, text: "", continuation: false });
      continue;
    }

    let startColumn = 0;
    let continuation = false;
    while (startColumn < line.length) {
      const remaining = line.slice(startColumn);
      if (remaining.length <= safeWidth) {
        visual.push({
          lineIndex,
          startColumn,
          endColumn: line.length,
          text: remaining.replaceAll("\t", " "),
          continuation,
        });
        break;
      }

      const slice = line.slice(startColumn, startColumn + safeWidth);
      const space = slice.lastIndexOf(" ");
      const endColumn = space > 0 ? startColumn + space : startColumn + safeWidth;
      visual.push({
        lineIndex,
        startColumn,
        endColumn,
        text: line.slice(startColumn, endColumn).replaceAll("\t", " "),
        continuation,
      });
      startColumn = space > 0 ? endColumn + 1 : endColumn;
      while (line[startColumn] === " ") startColumn += 1;
      continuation = true;
    }
  }

  return visual.length > 0 ? visual : [{ lineIndex: 0, startColumn: 0, endColumn: 0, text: "", continuation: false }];
}

/** Public helper for text Box Visual Cursor. */
export function textBoxVisualCursor(
  lines: readonly string[],
  cursor: CursorPosition,
  width: number,
  options: { wordWrap?: boolean } = {},
): TextBoxVisualCursor {
  const visualLines = wrapTextBoxLines(lines, width, options);
  return textBoxVisualCursorFromLines(visualLines, cursor, width);
}

function textBoxVisualCursorFromLines(
  visualLines: readonly TextBoxVisualLine[],
  cursor: CursorPosition,
  width: number,
): TextBoxVisualCursor {
  let fallbackRow = 0;
  for (const [row, line] of visualLines.entries()) {
    if (line.lineIndex !== cursor.y) continue;
    fallbackRow = row;
    if (cursor.x >= line.startColumn && cursor.x <= line.endColumn) {
      return {
        row,
        column: clamp(cursor.x - line.startColumn, 0, Math.max(0, width - 1)),
        line,
      };
    }
  }
  const line = visualLines[fallbackRow] ?? visualLines[0]!;
  return {
    row: fallbackRow,
    column: clamp(cursor.x - line.startColumn, 0, Math.max(0, width - 1)),
    line,
  };
}

/**
 * Component for creating interactive mutliline text input
 *
 * If you need singleline input use `Input` component.
 *
 * @example
 * ```ts
 * new TextBox({
 *  parent: tui,
 *  lineNumbering: true,
 *  lineHighlighting: true,
 *  theme: {
 *    base: crayon.bgGreen,
 *    focused: crayon.bgLightGreen,
 *    active: crayon.bgYellow,
 *  },
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    width: 10,
 *    height: 5,
 *  },
 *  zIndex: 0,
 * });
 * ```
 *
 * It supports validating input, e.g. number input would look like this:
 * @example
 * ```ts
 * new TextBox({
 *  ...,
 *  validator: /\d+/,
 * });
 * ```
 *
 * If you need to use emojis or other multi codepoint characters set `multiCodePointSupport` property to true.
 * @example
 * ```ts
 * new TextBox({
 *  ...,
 *  placeholder: "🧡",
 *  multiCodePointCharacter: true,
 * });
 * ```
 */
export class TextBox extends Box {
  declare drawnObjects: {
    box: BoxObject;
    lines: TextObject[];
    lineNumbers: TextObject[];
    cursor: TextObject;
  };
  declare theme: TextBoxTheme;

  #textLines: Computed<readonly string[]>;
  #visualLines: Computed<TextBoxVisualLine[]>;
  #visualCursor: Computed<TextBoxVisualCursor>;

  text: Signal<string>;
  validator: Signal<RegExp | undefined>;
  lineNumbering: Signal<boolean>;
  lineHighlighting: Signal<boolean>;
  wordWrap: Signal<boolean>;
  cursorPosition: Signal<CursorPosition>;
  multiCodePointSupport: Signal<boolean>;
  readonly controller: TextBoxController;

  constructor(options: TextBoxOptions) {
    super(options);

    this.theme.value ??= this.theme;
    this.theme.lineNumbers ??= this.theme;
    this.theme.highlightedLine ??= this.theme;

    const ownsController = !options.controller;
    const controller = options.controller ??
      new TextBoxController({
        text: options.text,
        cursorPosition: options.cursorPosition,
        validator: options.validator,
        lineNumbering: options.lineNumbering,
        lineHighlighting: options.lineHighlighting,
        wordWrap: options.wordWrap,
        multiCodePointSupport: options.multiCodePointSupport,
        onChange: options.onChange,
      });
    this.controller = controller;
    this.text = controller.text;
    this.validator = controller.validator;
    this.lineNumbering = controller.lineNumbering;
    this.lineHighlighting = controller.lineHighlighting;
    this.wordWrap = controller.wordWrap;
    this.cursorPosition = controller.cursorPosition;
    this.multiCodePointSupport = controller.multiCodePointSupport;
    this.#textLines = controller.lines;
    this.#visualLines = new Computed(() =>
      wrapTextBoxLines(this.#textLines.value, this.#textColumnWidth(), { wordWrap: this.wordWrap.value })
    );
    this.#visualCursor = new Computed(() =>
      textBoxVisualCursorFromLines(this.#visualLines.value, this.cursorPosition.value, this.#textColumnWidth())
    );

    new Effect(() => {
      this.#updateLineDrawObjects();
    });

    this.on(
      "keyPress",
      options.keyboardHandler ?? ((event) => {
        this.controller.handleKeyPress(event);
      }),
    );
    this.on("destroy", () => {
      disposeTextBoxComputed(this.#visualCursor);
      disposeTextBoxComputed(this.#visualLines);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();

    const { canvas } = this.tui;
    const { drawnObjects } = this;

    drawnObjects.lineNumbers = [];
    drawnObjects.lines = [];

    this.#updateLineDrawObjects();

    const cursorRectangle: TextRectangle = { column: 0, row: 0, width: 1 };
    const cursor = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      multiCodePointSupport: this.multiCodePointSupport,
      value: new Computed(() => {
        const visualCursor = this.#visualCursor.value;
        return visualCursor.line.text[visualCursor.column] ?? " ";
      }),
      style: new Computed(() => this.theme.cursor[this.state.value]),
      rectangle: new Computed(() => {
        const { row, column, width, height } = this.rectangle.value;
        const visualCursor = this.#visualCursor.value;
        const offsetY = Math.max(visualCursor.row - height + 1, 0);

        cursorRectangle.row = row + Math.min(Math.max(0, visualCursor.row - offsetY), height - 1);

        if (this.lineNumbering.value) {
          const lineNumbersWidth = this.#lineNumbersWidth();
          cursorRectangle.column = column + lineNumbersWidth +
            Math.min(visualCursor.column, width - lineNumbersWidth - 1);
        } else {
          cursorRectangle.column = column + Math.min(visualCursor.column, width - 1);
        }

        return cursorRectangle;
      }),
    });

    drawnObjects.cursor = cursor;
    cursor.draw();
  }

  override interact(method: "keyboard" | "mouse"): void {
    this.state.value = "focused";
    super.interact(method);
  }

  #updateLineDrawObjects(): void {
    const { lineNumbers, lines } = this.drawnObjects;

    const { height } = this.rectangle.value;
    const lineNumbering = this.lineNumbering.value;

    if (!lines) return;
    const { canvas } = this.tui;
    const elements = lines.length;

    for (let offset = 0; offset < Math.max(height, elements); ++offset) {
      const lineNumber = lineNumbers[offset];
      if (!lineNumber && lineNumbering) {
        const lineNumberRectangle: TextRectangle = { column: 0, row: 0, width: 0 };
        const lineNumber = new TextObject({
          canvas,
          view: this.view,
          zIndex: this.zIndex,
          multiCodePointSupport: this.multiCodePointSupport,
          style: new Computed(() => this.theme.lineNumbers[this.state.value]),
          value: new Computed(() => {
            const { height } = this.rectangle.value;
            const visualCursor = this.#visualCursor.value;

            const offsetY = Math.max(visualCursor.row - height + 1, 0);
            const visualLine = this.#visualLines.value[offset + offsetY];
            const maxLineNumber = this.#textLines.value.length;

            return visualLine && !visualLine.continuation
              ? `${visualLine.lineIndex + 1}`.padEnd(`${maxLineNumber}`.length, " ")
              : " ".repeat(`${maxLineNumber}`.length);
          }),
          rectangle: new Computed(() => {
            const { row, column } = this.rectangle.value;
            lineNumberRectangle.column = column;
            lineNumberRectangle.row = row + offset;
            lineNumberRectangle.width = this.#lineNumbersWidth();
            return lineNumberRectangle;
          }),
        });

        lineNumbers[offset] = lineNumber;
        lineNumber.draw();
      } else if (lineNumber && !lineNumbering) {
        lineNumber.erase();
        delete lineNumbers[offset];
      }

      const line = lines[offset];
      if (!line) {
        const lineRectangle: TextRectangle = { column: 0, row: 0, width: 0 };
        const line = new TextObject({
          canvas,
          view: this.view,
          zIndex: this.zIndex,
          multiCodePointSupport: this.multiCodePointSupport,
          style: new Computed(() => {
            // associate computed with this.text
            this.text.value;

            const state = this.state.value;
            const highlightLine = this.lineHighlighting.value;
            const visualCursor = this.#visualCursor.value;

            const offsetY = Math.max(visualCursor.row - this.rectangle.value.height + 1, 0);
            const currentLine = offsetY + offset;

            if (highlightLine && visualCursor.row === currentLine) {
              return this.theme.highlightedLine[state];
            } else return this.theme.value[state];
          }),
          value: new Computed(() => {
            const cursorPosition = this.cursorPosition.value;

            let { width, height } = this.rectangle.value;
            if (this.lineNumbering.value) {
              const lineNumbersWidth = this.#lineNumbersWidth();
              width -= lineNumbersWidth;
            }

            if (this.wordWrap.value) {
              const visualCursor = this.#visualCursor.value;
              const offsetY = Math.max(visualCursor.row - height + 1, 0);
              const value = this.#visualLines.value[offset + offsetY]?.text ?? "";
              return cropToWidth(value, width).padEnd(width, " ");
            }

            const offsetX = cursorPosition.x - width + 1;
            const offsetY = Math.max(cursorPosition.y - height + 1, 0);
            const value = this.#textLines.value[offset + offsetY]?.replace("\t", " ") ?? "";

            return cropToWidth(offsetX > 0 ? value.slice(offsetX, cursorPosition.x) : value, width).padEnd(width, " ");
          }),
          rectangle: new Computed(() => {
            // associate computed with this.lineNumbering and this.#textLines
            this.lineNumbering.value;
            this.#textLines.value;

            const { row, column } = this.rectangle.value;
            lineRectangle.column = column;
            lineRectangle.row = row + offset;

            if (this.lineNumbering.value) {
              const lineNumbersWidth = this.#lineNumbersWidth();
              lineRectangle.column += lineNumbersWidth;
            }

            return lineRectangle;
          }),
        });

        lines[offset] = line;
        line.draw();
      } else if (offset >= height) {
        line.erase();
        delete lines[offset];
      }
    }
  }

  #lineNumbersWidth(): number {
    return this.lineNumbering.value ? `${Math.max(1, this.#textLines.value.length)}`.length : 0;
  }

  #textColumnWidth(): number {
    return Math.max(1, this.rectangle.value.width - this.#lineNumbersWidth());
  }
}

function disposeTextBoxComputed(computed: { dispose(): void }): void {
  try {
    computed.dispose();
  } catch {
    // Computed dependency tracking is asynchronous in short-lived component tests.
  }
}
