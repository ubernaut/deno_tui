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
  multiCodePointSupport?: boolean;
}

interface ManagedTextRow {
  value: Computed<string>;
  rectangle: Computed<TextRectangle>;
  visible: Computed<boolean>;
}

interface ManagedTextRows {
  active: boolean;
  source: Signal<string[]>;
  rows: ManagedTextRow[];
  sync: () => void;
  scheduleSync: () => void;
}

const managedTextRows = new WeakMap<Component, Map<string, ManagedTextRows>>();

export function drawTextRows(
  component: Component,
  rows: Signal<string[]>,
  options: TextRowsOptions = {},
): void {
  const keyPrefix = options.keyPrefix ?? "row";
  const overwriteWidth = options.overwriteWidth ?? true;
  let groups = managedTextRows.get(component);
  if (!groups) {
    groups = new Map();
    managedTextRows.set(component, groups);
  }
  const existing = groups.get(keyPrefix);
  if (existing) {
    existing.source = rows;
    existing.sync();
    return;
  }

  const managed: ManagedTextRows = {
    active: true,
    source: rows,
    rows: [],
    scheduleSync: () => queueMicrotask(() => managed.active && managed.sync()),
    sync: () => {
      if (!managed.active) return;
      const height = Math.max(0, Math.floor(component.rectangle.peek().height));
      while (managed.rows.length < height) {
        const index = managed.rows.length;
        const value = new Computed(() => managed.source.value[index] ?? "");
        const rectangle = new Computed<TextRectangle>(() => ({
          column: component.rectangle.value.column,
          row: component.rectangle.value.row + index,
          width: component.rectangle.value.width,
        }));
        const visible = new Computed(() => component.visible.value && index < component.rectangle.value.height);
        drawTextChild(component, value, {
          key: `${keyPrefix}-${index}`,
          overwriteWidth,
          multiCodePointSupport: options.multiCodePointSupport,
          rectangle,
          visible,
        });
        managed.rows.push({ value, rectangle, visible });
      }
    },
  };
  groups.set(keyPrefix, managed);
  component.rectangle.subscribe(managed.scheduleSync);
  component.on("destroy", () => {
    managed.active = false;
    component.rectangle.unsubscribe(managed.scheduleSync);
    for (const row of managed.rows) {
      row.value.dispose();
      row.rectangle.dispose();
      row.visible.dispose();
    }
    groups?.delete(keyPrefix);
    if (groups?.size === 0) managedTextRows.delete(component);
  });
  managed.sync();
}
