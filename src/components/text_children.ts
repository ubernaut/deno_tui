// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import type { Component } from "../component.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text, type TextOptions } from "./text.ts";

export interface TextChildOptions {
  key?: string;
  overwriteWidth?: TextOptions["overwriteWidth"];
  multiCodePointSupport?: TextOptions["multiCodePointSupport"];
  rectangle?: TextOptions["rectangle"];
  visible?: TextOptions["visible"];
  zIndex?: TextOptions["zIndex"];
}

export function drawTextChild(
  component: Component,
  value: TextOptions["text"],
  options: TextChildOptions = {},
): Text {
  const text = new Text({
    parent: component,
    theme: component.theme,
    zIndex: options.zIndex ?? component.zIndex,
    text: value,
    overwriteWidth: options.overwriteWidth ?? true,
    multiCodePointSupport: options.multiCodePointSupport,
    rectangle: options.rectangle ??
      new Computed<TextRectangle>(() => ({
        column: component.rectangle.value.column,
        row: component.rectangle.value.row,
        width: component.rectangle.value.width,
      })),
    visible: options.visible ?? component.visible,
  });
  text.subComponentOf = component;
  component.subComponents[options.key ?? "text"] = text;
  return text;
}

interface TextRowsOptions {
  keyPrefix?: string;
  overwriteWidth?: boolean;
}

export function drawTextRows(
  component: Component,
  rows: Signal<string[]>,
  options: TextRowsOptions = {},
): void {
  const height = component.rectangle.peek().height;
  const keyPrefix = options.keyPrefix ?? "row";
  const overwriteWidth = options.overwriteWidth ?? true;

  for (let index = 0; index < height; index++) {
    drawTextChild(component, new Computed(() => rows.value[index] ?? ""), {
      key: `${keyPrefix}-${index}`,
      overwriteWidth,
      rectangle: new Computed<TextRectangle>(() => ({
        column: component.rectangle.value.column,
        row: component.rectangle.value.row + index,
        width: component.rectangle.value.width,
      })),
    });
  }
}
