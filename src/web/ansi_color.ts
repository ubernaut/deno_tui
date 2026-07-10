// Copyright 2023 Im-Beast. MIT license.
import { ansiCubeLevel } from "../utils/ansi_text.ts";

export function ansiColor(index: number): string {
  const colors = [
    "#0f172a",
    "#ef4444",
    "#22c55e",
    "#eab308",
    "#3b82f6",
    "#d946ef",
    "#06b6d4",
    "#e5e7eb",
    "#475569",
    "#fb7185",
    "#86efac",
    "#fde047",
    "#93c5fd",
    "#f0abfc",
    "#67e8f9",
    "#f8fafc",
  ];
  return colors[index] ?? "#dbeafe";
}

export function ansi256Color(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "#dbeafe";
  if (index < 16) return ansiColor(index);
  if (index >= 232) {
    const level = 8 + (Math.min(index, 255) - 232) * 10;
    return `rgb(${level},${level},${level})`;
  }
  const offset = Math.min(index, 231) - 16;
  const red = Math.floor(offset / 36);
  const green = Math.floor((offset % 36) / 6);
  const blue = offset % 6;
  return `rgb(${ansiCubeLevel(red)},${ansiCubeLevel(green)},${ansiCubeLevel(blue)})`;
}
