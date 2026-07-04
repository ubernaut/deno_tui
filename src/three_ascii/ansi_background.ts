// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import { colorToBytes, colorValue, rgbToAnsiBackground } from "./colors.ts";

const RESET = "\x1b[0m";

/** Tracks terminal background ANSI state for Three ASCII grid assembly. */
export class ThreeAsciiAnsiBackgroundState {
  key = -1;
  ansi = "";
  blankAnsi = "";
  red = 0;
  green = 0;
  blue = 0;

  private stableInput: string | number | undefined;
  private hasStableInput = false;
  private stableColorRef?: Color;
  private stableColorRed = Number.NaN;
  private stableColorGreen = Number.NaN;
  private stableColorBlue = Number.NaN;

  set(backgroundColor: Color | string | number | undefined): boolean {
    if (!(backgroundColor instanceof Color)) {
      const stableInput = backgroundColor ?? 0;
      if (this.hasStableInput && this.stableInput === stableInput) {
        return false;
      }
      this.hasStableInput = true;
      this.stableInput = stableInput;
      this.stableColorRef = undefined;
      return this.setColor(colorValue(backgroundColor, 0x000000));
    }

    this.hasStableInput = false;
    this.stableInput = undefined;
    if (
      this.stableColorRef === backgroundColor &&
      this.stableColorRed === backgroundColor.r &&
      this.stableColorGreen === backgroundColor.g &&
      this.stableColorBlue === backgroundColor.b
    ) {
      return false;
    }
    this.stableColorRef = backgroundColor;
    this.stableColorRed = backgroundColor.r;
    this.stableColorGreen = backgroundColor.g;
    this.stableColorBlue = backgroundColor.b;
    return this.setColor(backgroundColor);
  }

  clear(): void {
    this.key = -1;
    this.ansi = "";
    this.blankAnsi = "";
    this.red = 0;
    this.green = 0;
    this.blue = 0;
    this.hasStableInput = false;
    this.stableInput = undefined;
    this.stableColorRef = undefined;
    this.stableColorRed = Number.NaN;
    this.stableColorGreen = Number.NaN;
    this.stableColorBlue = Number.NaN;
  }

  private setColor(backgroundColor: Color): boolean {
    const [red, green, blue] = colorToBytes(backgroundColor);
    const key = (red << 16) | (green << 8) | blue;
    if (key === this.key) {
      return false;
    }

    this.key = key;
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.ansi = rgbToAnsiBackground(red, green, blue);
    this.blankAnsi = `${this.ansi} ${RESET}`;
    return true;
  }
}
