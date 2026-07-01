// Copyright 2023 Im-Beast. MIT license.
import type { WidgetHitRegion } from "../../components/interaction.ts";
import type { Rectangle } from "../../types.ts";
import { type ComputedLayoutStyle, type LayoutLengthValue, resolveLayoutLength } from "../style.ts";
import type { LayoutNode } from "../solver.ts";

/** Grid placement bounds used by the simple layout solver. */
export interface GridPlacementBounds {
  columns: number;
  rows: number;
  autoFlow: ComputedLayoutStyle["gridAutoFlow"];
  areas?: readonly (readonly string[])[];
}

/** Grid placement result for one child node. */
export interface GridPlacedItem {
  node: LayoutNode;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

interface GridPlacementCandidate {
  node: LayoutNode;
  columnSpan: number;
  rowSpan: number;
  explicitColumn?: number;
  explicitRow?: number;
}

interface FindGridSlotOptions {
  preferredColumn?: number;
  preferredRow?: number;
  columnSpan: number;
  rowSpan: number;
  maxColumns?: number;
  maxRows?: number;
  scanColumns: number;
  scanRows: number;
  autoFlow: ComputedLayoutStyle["gridAutoFlow"];
}

/** Places grid children using explicit coordinates first, then auto-flow placement. */
export function placeGridChildren(children: readonly LayoutNode[], bounds: GridPlacementBounds): GridPlacedItem[] {
  const placed = new Map<LayoutNode, GridPlacedItem>();
  const occupied = new Set<string>();
  const autoColumns = bounds.columns > 0 ? bounds.columns : Math.max(1, Math.ceil(Math.sqrt(children.length)));
  const autoRows = bounds.rows > 0 ? bounds.rows : Math.max(1, Math.ceil(Math.sqrt(children.length)));
  const candidates = children.map((child): GridPlacementCandidate => {
    const area = child.style.gridArea ? gridTemplateAreaBounds(bounds.areas ?? [], child.style.gridArea) : undefined;
    const hasExplicitColumn = gridPlacementHasExplicitLine(child.style.gridColumn);
    const hasExplicitRow = gridPlacementHasExplicitLine(child.style.gridRow);
    return {
      node: child,
      columnSpan: hasExplicitColumn ? gridPlacementSpan(child.style.gridColumn) : area?.columnSpan ??
        gridPlacementSpan(child.style.gridColumn),
      rowSpan: hasExplicitRow ? gridPlacementSpan(child.style.gridRow) : area?.rowSpan ??
        gridPlacementSpan(child.style.gridRow),
      explicitColumn: gridPlacementStart(child.style.gridColumn) ?? area?.column,
      explicitRow: gridPlacementStart(child.style.gridRow) ?? area?.row,
    };
  });
  const placementOrder = [
    ...candidates.filter((candidate) => candidate.explicitColumn !== undefined && candidate.explicitRow !== undefined),
    ...candidates.filter((candidate) =>
      (candidate.explicitColumn !== undefined) !== (candidate.explicitRow !== undefined)
    ),
    ...candidates.filter((candidate) => candidate.explicitColumn === undefined && candidate.explicitRow === undefined),
  ];

  for (const candidate of placementOrder) {
    const position = candidate.explicitColumn !== undefined && candidate.explicitRow !== undefined
      ? { column: candidate.explicitColumn, row: candidate.explicitRow }
      : candidate.explicitColumn !== undefined
      ? findGridSlot(occupied, {
        preferredColumn: candidate.explicitColumn,
        columnSpan: candidate.columnSpan,
        rowSpan: candidate.rowSpan,
        maxColumns: undefined,
        maxRows: undefined,
        scanColumns: Math.max(autoColumns, candidate.explicitColumn + candidate.columnSpan),
        scanRows: autoRows,
        autoFlow: bounds.autoFlow,
      })
      : candidate.explicitRow !== undefined
      ? findGridSlot(occupied, {
        preferredRow: candidate.explicitRow,
        columnSpan: candidate.columnSpan,
        rowSpan: candidate.rowSpan,
        maxColumns: bounds.columns > 0 ? bounds.columns : undefined,
        maxRows: undefined,
        scanColumns: autoColumns,
        scanRows: Math.max(autoRows, candidate.explicitRow + candidate.rowSpan),
        autoFlow: bounds.autoFlow,
      })
      : findGridSlot(occupied, {
        columnSpan: candidate.columnSpan,
        rowSpan: candidate.rowSpan,
        maxColumns: bounds.autoFlow === "row" && bounds.columns > 0 ? bounds.columns : undefined,
        maxRows: bounds.autoFlow === "column" && bounds.rows > 0 ? bounds.rows : undefined,
        scanColumns: autoColumns,
        scanRows: autoRows,
        autoFlow: bounds.autoFlow,
      });

    occupyGridCells(occupied, position.row, position.column, candidate.rowSpan, candidate.columnSpan);
    placed.set(candidate.node, {
      node: candidate.node,
      column: position.column,
      row: position.row,
      columnSpan: candidate.columnSpan,
      rowSpan: candidate.rowSpan,
    });
  }

  return children.map((child) => placed.get(child)!).filter(Boolean);
}

/** Aligns a grid item inside its resolved grid cell. */
export function alignGridItemBounds(node: LayoutNode, cell: Rectangle): Rectangle {
  const width = node.style.justifySelf === "stretch" || node.style.width.unit === "auto"
    ? cell.width
    : Math.min(cell.width, resolveLayoutLength(node.style.width, cell.width, cell.width));
  const height = node.style.alignSelf === "stretch" || node.style.height.unit === "auto"
    ? cell.height
    : Math.min(cell.height, resolveLayoutLength(node.style.height, cell.height, cell.height));
  return {
    column: cell.column + alignmentOffset(cell.width, width, node.style.justifySelf),
    row: cell.row + alignmentOffset(cell.height, height, node.style.alignSelf),
    width,
    height,
  };
}

/** Resolves CSS-like grid tracks into terminal-cell track sizes. */
export function resolveGridTracks(
  template: readonly LayoutLengthValue[],
  count: number,
  available: number,
  gap: number,
  autoTrack: LayoutLengthValue,
): number[] {
  const trackCount = Math.max(1, count);
  const tracks = new Array<LayoutLengthValue>(trackCount);
  for (let index = 0; index < trackCount; index++) {
    tracks[index] = template[index] ?? autoTrack;
  }
  const totalGap = Math.max(0, trackCount - 1) * Math.max(0, gap);
  const availableWithoutGaps = Math.max(0, Math.floor(available) - totalGap);
  const sizes = new Array<number>(trackCount).fill(0);
  const autoIndexes: number[] = [];
  const frIndexes: number[] = [];
  let fixed = 0;
  let frTotal = 0;

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index] ?? autoTrack;
    if (track.unit === "cell") {
      sizes[index] = Math.max(0, Math.floor(track.value));
      fixed += sizes[index]!;
    } else if (track.unit === "percent") {
      sizes[index] = Math.max(0, Math.floor(availableWithoutGaps * track.value / 100));
      fixed += sizes[index]!;
    } else if (track.unit === "fr") {
      frIndexes.push(index);
      frTotal += Math.max(0, track.value);
    } else {
      autoIndexes.push(index);
    }
  }

  let remaining = Math.max(0, availableWithoutGaps - fixed);
  if (frIndexes.length > 0 && frTotal > 0) {
    let assigned = 0;
    for (const [frIndex, trackIndex] of frIndexes.entries()) {
      const track = tracks[trackIndex] ?? autoTrack;
      const size = frIndex === frIndexes.length - 1
        ? remaining - assigned
        : Math.floor(remaining * Math.max(0, track.value) / frTotal);
      sizes[trackIndex] = Math.max(0, size);
      assigned += sizes[trackIndex]!;
    }
    remaining = Math.max(0, availableWithoutGaps - fixed - assigned);
  }

  if (autoIndexes.length > 0) {
    const base = Math.floor(remaining / autoIndexes.length);
    let extra = remaining % autoIndexes.length;
    for (const trackIndex of autoIndexes) {
      sizes[trackIndex] = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
    }
  }

  shrinkGridTracksToFit(sizes, availableWithoutGaps);
  return sizes.map((size) => Math.max(0, Math.floor(size)));
}

/** Computes terminal-cell offsets for resolved grid tracks. */
export function gridTrackOffsets(start: number, tracks: readonly number[], gap: number): number[] {
  const offsets: number[] = [];
  let cursor = start;
  for (const track of tracks) {
    offsets.push(cursor);
    cursor += Math.max(0, track) + Math.max(0, gap);
  }
  return offsets;
}

/** Computes the terminal-cell size of a grid span. */
export function gridSpanSize(tracks: readonly number[], start: number, span: number, gap: number): number {
  const safeSpan = Math.max(1, span);
  let size = 0;
  for (let offset = 0; offset < safeSpan; offset += 1) {
    size += tracks[start + offset] ?? 0;
  }
  return Math.max(0, size + Math.max(0, safeSpan - 1) * Math.max(0, gap));
}

/** Builds the default hit region for a grid-laid-out node. */
export function hitRegionForNode(
  node: LayoutNode,
  bounds: Rectangle,
  zIndex: number,
): WidgetHitRegion<{ nodeId: string; tag: string }> {
  return {
    id: node.id,
    bounds,
    zIndex,
    payload: { nodeId: node.id, tag: node.tag },
  };
}

function findGridSlot(occupied: Set<string>, options: FindGridSlotOptions): { column: number; row: number } {
  const scanColumns = Math.max(
    1,
    options.scanColumns,
    options.preferredColumn !== undefined ? options.preferredColumn + 1 : 1,
  );
  const scanRows = Math.max(1, options.scanRows, options.preferredRow !== undefined ? options.preferredRow + 1 : 1);
  const limit = Math.max(scanColumns * scanRows + occupied.size + 16, 32);

  if (options.preferredColumn !== undefined) {
    for (let row = options.preferredRow ?? 0; row < limit; row += 1) {
      if (gridCellsAvailable(occupied, row, options.preferredColumn, options.rowSpan, options.columnSpan, options)) {
        return { column: options.preferredColumn, row };
      }
    }
  }

  if (options.preferredRow !== undefined) {
    for (let column = options.preferredColumn ?? 0; column < limit; column += 1) {
      if (gridCellsAvailable(occupied, options.preferredRow, column, options.rowSpan, options.columnSpan, options)) {
        return { column, row: options.preferredRow };
      }
    }
  }

  if (options.autoFlow === "column") {
    for (let column = 0; column < limit; column += 1) {
      for (let row = 0; row < scanRows || row < limit && options.maxRows === undefined; row += 1) {
        if (gridCellsAvailable(occupied, row, column, options.rowSpan, options.columnSpan, options)) {
          return { column, row };
        }
      }
    }
  } else {
    for (let row = 0; row < limit; row += 1) {
      for (let column = 0; column < scanColumns || column < limit && options.maxColumns === undefined; column += 1) {
        if (gridCellsAvailable(occupied, row, column, options.rowSpan, options.columnSpan, options)) {
          return { column, row };
        }
      }
    }
  }

  return { column: 0, row: 0 };
}

function gridCellsAvailable(
  occupied: Set<string>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
  options: FindGridSlotOptions,
): boolean {
  if (row < 0 || column < 0) return false;
  if (options.maxColumns !== undefined && column + columnSpan > options.maxColumns) return false;
  if (options.maxRows !== undefined && row + rowSpan > options.maxRows) return false;
  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
      if (occupied.has(gridCellKey(row + rowOffset, column + columnOffset))) return false;
    }
  }
  return true;
}

function occupyGridCells(
  occupied: Set<string>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
): void {
  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
      occupied.add(gridCellKey(row + rowOffset, column + columnOffset));
    }
  }
}

function gridCellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function gridPlacementSpan(placement: ComputedLayoutStyle["gridColumn"]): number {
  if (placement.span !== undefined) return Math.max(1, placement.span);
  if (placement.start !== undefined && placement.end !== undefined) return Math.max(1, placement.end - placement.start);
  return 1;
}

function gridPlacementHasExplicitLine(placement: ComputedLayoutStyle["gridColumn"]): boolean {
  return placement.start !== undefined || placement.end !== undefined || placement.span !== undefined;
}

function gridPlacementStart(placement: ComputedLayoutStyle["gridColumn"]): number | undefined {
  if (placement.start !== undefined) return Math.max(0, placement.start - 1);
  if (placement.end !== undefined && placement.span !== undefined) {
    return Math.max(0, placement.end - placement.span - 1);
  }
  return undefined;
}

function gridTemplateAreaBounds(
  areas: readonly (readonly string[])[],
  name: string,
): { column: number; row: number; columnSpan: number; rowSpan: number } | undefined {
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = -1;

  for (const [row, cells] of areas.entries()) {
    for (const [column, cell] of cells.entries()) {
      if (cell !== name) continue;
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minColumn = Math.min(minColumn, column);
      maxColumn = Math.max(maxColumn, column);
    }
  }

  if (maxRow < 0 || maxColumn < 0) return undefined;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      if (areas[row]?.[column] !== name) return undefined;
    }
  }

  return {
    column: minColumn,
    row: minRow,
    columnSpan: maxColumn - minColumn + 1,
    rowSpan: maxRow - minRow + 1,
  };
}

function alignmentOffset(available: number, size: number, alignment: ComputedLayoutStyle["justifySelf"]): number {
  const free = Math.max(0, available - size);
  if (alignment === "end") return free;
  if (alignment === "center") return Math.floor(free / 2);
  return 0;
}

function shrinkGridTracksToFit(sizes: number[], available: number): void {
  let overflow = sizes.reduce((sum, size) => sum + size, 0) - Math.max(0, available);
  for (let index = sizes.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const removable = Math.min(sizes[index] ?? 0, overflow);
    sizes[index] = Math.max(0, (sizes[index] ?? 0) - removable);
    overflow -= removable;
  }
}
