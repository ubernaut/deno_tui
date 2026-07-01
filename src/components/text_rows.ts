// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import type { Component } from "../component.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

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
    const text = new Text({
      parent: component,
      theme: component.theme,
      zIndex: component.zIndex,
      text: new Computed(() => rows.value[index] ?? ""),
      overwriteWidth,
      rectangle: new Computed<TextRectangle>(() => ({
        column: component.rectangle.value.column,
        row: component.rectangle.value.row + index,
        width: component.rectangle.value.width,
      })),
      visible: component.visible,
    });
    text.subComponentOf = component;
    component.subComponents[`${keyPrefix}-${index}`] = text;
  }
}
