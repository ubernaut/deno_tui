// Copyright 2023 Im-Beast. MIT license.
import { Component, ComponentOptions } from "../component.ts";

import { BoxObject } from "../canvas/box.ts";
import { TextObject } from "../canvas/text.ts";

import type { DeepPartial, Rectangle } from "../types.ts";
import { Theme } from "../theme.ts";
import { textWidth } from "../utils/strings.ts";
import { clamp } from "../utils/numbers.ts";
import { Computed, Effect, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import type { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "../input_reader/types.ts";

/** Public constant for a table Unicode Characters. */
export const TableUnicodeCharacters = {
  sharp: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    leftHorizontal: "├",
    rightHorizontal: "┤",
    horizontal: "─",
    vertical: "│",
  },
  rounded: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    leftHorizontal: "├",
    rightHorizontal: "┤",
    horizontal: "─",
    vertical: "│",
  },
};

/** Public type alias for a table Unicode Characters Type. */
export type TableUnicodeCharactersType = {
  [key in keyof typeof TableUnicodeCharacters["rounded"]]: string;
};

/** Public interface describing a table Theme. */
export interface TableTheme extends Theme {
  frame: Theme;
  header: Theme;
  selectedRow: Theme;
}

/** Public type alias for a table Header. */
export type TableHeader<WidthDefined extends boolean> = {
  title: string;
} & (WidthDefined extends true ? { width: number } : { width?: number });

/** Options for configuring table. */
export interface TableOptions extends Omit<ComponentOptions, "rectangle"> {
  theme: DeepPartial<TableTheme, "frame" | "header" | "selectedRow">;
  headers: TableHeader<false>[];
  rectangle: Omit<Rectangle, "width">;
  data: string[][];
  charMap: keyof typeof TableUnicodeCharacters | TableUnicodeCharactersType;
  selectedRow?: number | Signal<number>;
  offsetRow?: number | Signal<number>;
  controller?: TableController;
  onSelect?: (row: number) => void | Promise<void>;
}

/** Options for configuring table Controller. */
export interface TableControllerOptions {
  rowCount?: number | Signal<number>;
  viewportHeight?: number | Signal<number>;
  selectedRow?: number | Signal<number>;
  offsetRow?: number | Signal<number>;
  onSelect?: (row: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for table. */
export interface TableInspection {
  rowCount: number;
  selectedRow: number;
  offsetRow: number;
  viewportHeight: number;
  visibleCapacity: number;
  maxOffsetRow: number;
  empty: boolean;
}

/** Public helper for table Visible Capacity. */
export function tableVisibleCapacity(viewportHeight: number): number {
  return Math.max(0, Math.floor(viewportHeight) - 4);
}

/** Public helper for table Max Offset. */
export function tableMaxOffset(rowCount: number, viewportHeight: number): number {
  return Math.max(0, Math.floor(rowCount) - tableVisibleCapacity(viewportHeight));
}

/** Public helper for table auto Column Widths. */
export function tableAutoColumnWidths(
  headers: readonly TableHeader<false>[],
  data: readonly (readonly string[])[],
): number[] {
  const widths = new Array<number>(headers.length);
  for (let column = 0; column < headers.length; column += 1) {
    let width = textWidth(headers[column]!.title);
    for (let row = 0; row < data.length; row += 1) {
      const cellWidth = textWidth(data[row]![column]);
      if (cellWidth > width) width = cellWidth;
    }
    widths[column] = width;
  }
  return widths;
}

/** Clamps table Row to its valid range. */
export function clampTableRow(row: number, rowCount: number): number {
  return clamp(Math.floor(row), 0, Math.max(0, Math.floor(rowCount) - 1));
}

/** State controller for table behavior. */
export class TableController {
  readonly rowCount: Signal<number>;
  readonly viewportHeight: Signal<number>;
  readonly selectedRow: Signal<number>;
  readonly offsetRow: Signal<number>;
  readonly #ownsRowCount: boolean;
  readonly #ownsViewportHeight: boolean;
  readonly #ownsSelectedRow: boolean;
  readonly #ownsOffsetRow: boolean;
  readonly #onSelect?: (row: number) => void | Promise<void>;
  readonly #syncBounds = () => {
    this.selectedRow.value = clampTableRow(this.selectedRow.peek(), this.rowCount.peek());
    this.offsetRow.value = clamp(
      this.offsetRow.peek(),
      0,
      tableMaxOffset(this.rowCount.peek(), this.viewportHeight.peek()),
    );
  };

  constructor(options: TableControllerOptions = {}) {
    this.#ownsRowCount = !(options.rowCount instanceof Signal);
    this.#ownsViewportHeight = !(options.viewportHeight instanceof Signal);
    this.#ownsSelectedRow = !(options.selectedRow instanceof Signal);
    this.#ownsOffsetRow = !(options.offsetRow instanceof Signal);
    this.rowCount = signalify(options.rowCount ?? 0);
    this.viewportHeight = signalify(options.viewportHeight ?? 0);
    this.selectedRow = signalify(options.selectedRow ?? 0);
    this.offsetRow = signalify(options.offsetRow ?? 0);
    this.#onSelect = options.onSelect;
    this.rowCount.subscribe(this.#syncBounds);
    this.viewportHeight.subscribe(this.#syncBounds);
    this.selectedRow.subscribe(this.#syncBounds);
    this.offsetRow.subscribe(this.#syncBounds);
    this.#syncBounds();
  }

  setRowCount(rowCount: number): number {
    this.rowCount.value = Math.max(0, Math.floor(rowCount));
    return this.rowCount.peek();
  }

  setViewportHeight(height: number): number {
    this.viewportHeight.value = Math.max(0, Math.floor(height));
    return this.viewportHeight.peek();
  }

  select(row: number, reveal = true): number {
    this.selectedRow.value = clampTableRow(row, this.rowCount.peek());
    if (reveal) this.revealSelected();
    void this.#onSelect?.(this.selectedRow.peek());
    return this.selectedRow.peek();
  }

  move(delta: number): number {
    return this.select(this.selectedRow.peek() + Math.floor(delta));
  }

  first(): number {
    return this.select(0);
  }

  last(): number {
    return this.select(this.rowCount.peek() - 1);
  }

  pageUp(): number {
    return this.move(-Math.max(1, tableVisibleCapacity(this.viewportHeight.peek())));
  }

  pageDown(): number {
    return this.move(Math.max(1, tableVisibleCapacity(this.viewportHeight.peek())));
  }

  scroll(delta: number): number {
    this.offsetRow.value = clamp(
      this.offsetRow.peek() + Math.floor(delta),
      0,
      tableMaxOffset(this.rowCount.peek(), this.viewportHeight.peek()),
    );
    return this.offsetRow.peek();
  }

  revealSelected(): number {
    const capacity = tableVisibleCapacity(this.viewportHeight.peek());
    const maxOffset = tableMaxOffset(this.rowCount.peek(), this.viewportHeight.peek());
    if (capacity <= 0) {
      this.offsetRow.value = 0;
    } else {
      this.offsetRow.value = clamp(this.selectedRow.peek() - Math.floor(capacity / 2), 0, maxOffset);
    }
    return this.offsetRow.peek();
  }

  selectViewportRow(y: number, tableRow: number): number | undefined {
    const dataRow = Math.floor(y) - Math.floor(tableRow) + this.offsetRow.peek() - 3;
    if (dataRow !== clampTableRow(dataRow, this.rowCount.peek())) return undefined;
    return this.select(dataRow, false);
  }

  handleKeyPress(event: KeyPressEvent): number | undefined {
    if (event.ctrl || event.meta || event.shift) return undefined;
    switch (event.key) {
      case "up":
        return this.move(-1);
      case "down":
        return this.move(1);
      case "pageup":
        return this.pageUp();
      case "pagedown":
        return this.pageDown();
      case "home":
        return this.first();
      case "end":
        return this.last();
      case "return":
        void this.#onSelect?.(this.selectedRow.peek());
        return this.selectedRow.peek();
    }
    return undefined;
  }

  handleMouseEvent(event: MouseEvent | MousePressEvent | MouseScrollEvent, tableRow: number): number | undefined {
    if (event.ctrl || event.meta || event.shift) return undefined;
    if ("scroll" in event) return this.scroll(event.scroll);
    if ("button" in event) return this.selectViewportRow(event.y, tableRow);
    return undefined;
  }

  inspect(): TableInspection {
    const rowCount = this.rowCount.peek();
    const viewportHeight = this.viewportHeight.peek();
    return {
      rowCount,
      selectedRow: this.selectedRow.peek(),
      offsetRow: this.offsetRow.peek(),
      viewportHeight,
      visibleCapacity: tableVisibleCapacity(viewportHeight),
      maxOffsetRow: tableMaxOffset(rowCount, viewportHeight),
      empty: rowCount === 0,
    };
  }

  dispose(): void {
    this.rowCount.unsubscribe(this.#syncBounds);
    this.viewportHeight.unsubscribe(this.#syncBounds);
    this.selectedRow.unsubscribe(this.#syncBounds);
    this.offsetRow.unsubscribe(this.#syncBounds);
    if (this.#ownsRowCount) this.rowCount.dispose();
    if (this.#ownsViewportHeight) this.viewportHeight.dispose();
    if (this.#ownsSelectedRow) this.selectedRow.dispose();
    if (this.#ownsOffsetRow) this.offsetRow.dispose();
  }
}

/**
 * Component for creating interactive table
 *
 * Rectangle's `width` gets automatically calculcated from given headers.
 *
 * You can specify each header's width explicitly or leave it out to let Table to figure it out.
 *
 * @example
 * ```ts
 * new Table({
 *   parent: tui,
 *   theme: {
 *     base: crayon.bgBlack.white,
 *     frame: { base: crayon.bgBlack },
 *     header: { base: crayon.bgBlack.bold.lightBlue },
 *     selectedRow: {
 *       base: crayon.bold.bgBlue.white,
 *       focused: crayon.bold.bgLightBlue.white,
 *       active: crayon.bold.bgMagenta.black,
 *     },
 *   },
 *   rectangle: {
 *     column: 1,
 *     row: 1,
 *     height: 10,
 *   },
 *   headers: [
 *     { title: "ID" },
 *     { title: "Name" },
 *   ],
 *   data: [
 *     ["0", "Thomas Jeronimo"],
 *     ["1", "Jeremy Wanker"],
 *     ["2", "Julianne James"],
 *     ["3", "Tommie Moyer"],
 *     ["4", "Marta Reilly"],
 *     ["5", "Bernardo Robertson"],
 *     ["6", "Hershel Grant"],
 *   ],
 *   charMap: "rounded",
 *   zIndex: 0,
 * });
 *
 * ```
 */
export class Table extends Component {
  declare theme: TableTheme;
  declare drawnObjects: {
    frame: [
      top: TextObject,
      bottom: TextObject,
      spacer: TextObject,
      left: BoxObject,
      right: BoxObject,
    ];

    header: TextObject;
    data: TextObject[];
  };

  data: Signal<string[][]>;
  headers: Signal<TableHeader<true>[]>;
  charMap: Signal<TableUnicodeCharactersType>;
  selectedRow: Signal<number>;
  offsetRow: Signal<number>;
  readonly controller: TableController;
  readonly #syncRowCount = (data: string[][]) => {
    this.controller.setRowCount(data.length);
  };
  readonly #syncViewportHeight = () => {
    this.controller.setViewportHeight(this.rectangle.peek().height);
  };

  constructor(options: TableOptions) {
    super(options as unknown as ComponentOptions);

    this.data = signalify(options.data, { deepObserve: true });
    this.charMap = signalify(
      typeof options.charMap === "string" ? TableUnicodeCharacters[options.charMap] : options.charMap,
      { deepObserve: true },
    );
    this.headers = signalify(options.headers as TableHeader<true>[], { deepObserve: true });
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new TableController({
        rowCount: this.data.peek().length,
        viewportHeight: this.rectangle.peek().height,
        selectedRow: options.selectedRow,
        offsetRow: options.offsetRow,
        onSelect: options.onSelect,
      });
    this.selectedRow = this.controller.selectedRow;
    this.offsetRow = this.controller.offsetRow;

    new Effect(() => {
      const headers = this.headers.value;
      const widths = tableAutoColumnWidths(headers, this.data.value);
      let width = 1;
      for (let i = 0; i < headers.length; i += 1) {
        const header = headers[i];
        header.width = widths[i]!;
        width += header.width + 1;
      }
      this.rectangle.value.width = width;
    });

    this.data.subscribe((data) => {
      this.#syncRowCount(data);
      const dataDrawObjects = this.drawnObjects.data?.length;
      if (!dataDrawObjects) return;
      if (data.length > dataDrawObjects) {
        this.#fillDataDrawObjects();
      } else if (data.length < dataDrawObjects) {
        this.#popUnusedDataDrawObjects();
      }
    });
    this.rectangle.subscribe(this.#syncViewportHeight);

    this.on("keyPress", (event) => {
      this.controller.handleKeyPress(event);
    });

    this.on("mouseEvent", (mouseEvent) => {
      this.controller.handleMouseEvent(mouseEvent, this.rectangle.peek().row);
    });

    this.on("destroy", () => {
      this.data.unsubscribe(this.#syncRowCount);
      this.rectangle.unsubscribe(this.#syncViewportHeight);
      if (ownsController) this.controller.dispose();
    });
  }

  override draw(): void {
    super.draw();

    const { canvas } = this.tui;
    const { drawnObjects } = this;

    // Drawing header cells
    const headerRectangle = { column: 0, row: 0 };
    const header = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      style: new Computed(() => this.theme.header[this.state.value]),
      rectangle: new Computed(() => {
        const { column, row } = this.rectangle.value;
        headerRectangle.column = column + 1;
        headerRectangle.row = row + 1;
        return headerRectangle;
      }),
      value: new Computed(() => {
        // associate computed with this.data
        this.data.value;

        const headers = this.headers.value;
        let value = "";

        for (const header of headers) {
          // Ensures non-negative numbers
          const endPadding = Math.max(0, header.width + 1 - textWidth(header.title));
          value += header.title + " ".repeat(endPadding);
        }

        return value;
      }),
    });

    header.draw();
    drawnObjects.header = header;

    // Drawing data cells
    drawnObjects.data = [];
    this.#fillDataDrawObjects();

    // Drawing frame
    const frameStyleSignal = new Computed(() => this.theme.frame[this.state.value]);

    const topRectangle = { column: 0, row: 0 };
    const top = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      style: frameStyleSignal,
      rectangle: new Computed(() => {
        const { column, row } = this.rectangle.value;
        topRectangle.column = column;
        topRectangle.row = row;
        return topRectangle;
      }),
      value: new Computed(() => {
        const { topLeft, horizontal, topRight } = this.charMap.value;
        return topLeft + horizontal.repeat(Math.max(this.rectangle.value.width - 2, 0)) + topRight;
      }),
    });

    const bottomRectangle = { column: 0, row: 0 };
    const bottom = new TextObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      style: frameStyleSignal,
      rectangle: new Computed(() => {
        const { column, row, height } = this.rectangle.value;
        bottomRectangle.column = column;
        bottomRectangle.row = row + height - 1;
        return bottomRectangle;
      }),
      value: new Computed(() => {
        const { bottomLeft, horizontal, bottomRight } = this.charMap.value;
        return bottomLeft + horizontal.repeat(Math.max(this.rectangle.value.width - 2, 0)) + bottomRight;
      }),
    });

    const verticalCharMapSignal = new Computed(() => this.charMap.value.vertical);

    const leftRectangle = { column: 0, row: 0, width: 1, height: 0 };
    const left = new BoxObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      style: frameStyleSignal,
      filler: verticalCharMapSignal,
      rectangle: new Computed(() => {
        const { column, row, height } = this.rectangle.value;
        leftRectangle.column = column;
        leftRectangle.row = row + 1;
        leftRectangle.height = height - 2;
        return leftRectangle;
      }),
    });

    const rightRectangle = { column: 0, row: 0, width: 1, height: 0 };
    const right = new BoxObject({
      canvas,
      view: this.view,
      zIndex: this.zIndex,
      filler: verticalCharMapSignal,
      style: frameStyleSignal,
      rectangle: new Computed(() => {
        const { column, row, width, height } = this.rectangle.value;
        rightRectangle.column = column + width - 1;
        rightRectangle.row = row + 1;
        rightRectangle.height = height - 2;
        return rightRectangle;
      }),
    });

    const middleRectangle = { column: 0, row: 0 };
    const spacer = new TextObject({
      canvas,
      zIndex: this.zIndex,
      style: frameStyleSignal,
      rectangle: new Computed(() => {
        const { column, row } = this.rectangle.value;
        middleRectangle.column = column;
        middleRectangle.row = row + 2;
        return middleRectangle;
      }),
      value: new Computed(() => {
        const { leftHorizontal, horizontal, rightHorizontal } = this.charMap.value;
        return leftHorizontal + horizontal.repeat(Math.max(this.rectangle.value.width - 2, 0)) + rightHorizontal;
      }),
    });

    drawnObjects.frame = [top, bottom, spacer, left, right];

    top.draw();
    bottom.draw();
    left.draw();
    right.draw();
    spacer.draw();
  }

  override interact(method: "mouse" | "keyboard"): void {
    const interactionInterval = Date.now() - this.lastInteraction.time;

    this.state.value = this.state.peek() === "focused" && (interactionInterval < 500 || method === "keyboard")
      ? "active"
      : "focused";

    super.interact(method);
  }

  #fillDataDrawObjects(): void {
    const { canvas } = this.tui;
    const { drawnObjects } = this;

    for (let i = drawnObjects.data.length; i < this.rectangle.peek().height - 4; ++i) {
      const textRectangle = { column: 0, row: 0 };
      const text = new TextObject({
        canvas,
        view: this.view,
        zIndex: this.zIndex,
        style: new Computed(() => {
          const offsetRow = this.offsetRow.value;
          const selectedRow = this.selectedRow.value;
          const selectedRowStyle = this.theme.selectedRow[this.state.value];
          const style = this.style.value;
          return (i + offsetRow) === selectedRow ? selectedRowStyle : style;
        }),
        value: new Computed(() => {
          const dataRow = this.data.value[i + this.offsetRow.value];
          if (!dataRow) return "";
          const headers = this.headers.value;

          let string = "";
          let prevData = "";
          for (const [j, dataCell] of dataRow.entries()) {
            if (j !== 0) {
              const padding = Math.max(0, headers[j - 1].width - textWidth(prevData) + 1);
              string += " ".repeat(padding);
            }
            string += dataCell;
            prevData = dataCell;
          }

          const endPadding = Math.max(0, this.rectangle.value.width - textWidth(string) - 2);
          string += " ".repeat(endPadding);
          return string;
        }),
        rectangle: new Computed(() => {
          const { column, row } = this.rectangle.value;
          textRectangle.column = column + 1;
          textRectangle.row = row + i + 3;
          return textRectangle;
        }),
      });

      drawnObjects.data.push(text);
      text.draw();
    }
  }

  #popUnusedDataDrawObjects(): void {
    for (const dataCell of this.drawnObjects.data.splice(this.data.value.length)) {
      dataCell.erase();
    }
  }
}
