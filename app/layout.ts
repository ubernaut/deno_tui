import type { LayoutId, Rect, SlotId, ViewportMode } from "./types.ts";

const MONITOR_SLOT_IDS: SlotId[] = ["cpu", "cpuLegend", "memory", "temperature", "disk", "network", "processes"];

export function detectViewportMode(bounds: Rect): ViewportMode {
  if (bounds.width < 90 || bounds.height < 26) {
    return "mobile";
  }

  if (bounds.width < 128 || bounds.height < 34) {
    return "compact";
  }

  return "desktop";
}

export function resolveResponsiveLayout(requestedLayout: LayoutId, bounds: Rect): LayoutId {
  const viewportMode = detectViewportMode(bounds);

  if (viewportMode === "desktop") {
    return requestedLayout;
  }

  if (viewportMode === "compact") {
    return requestedLayout === "monitor" ? "quad" : requestedLayout;
  }

  switch (requestedLayout) {
    case "monitor":
    case "quad":
    case "horizontal":
      return "single";
    case "vertical":
      return bounds.width >= 72 ? "vertical" : "single";
    default:
      return requestedLayout;
  }
}

export function visibleSlotIds(currentLayout: LayoutId, primarySlot: SlotId): SlotId[] {
  switch (currentLayout) {
    case "single":
      return [primarySlot];
    case "vertical":
      return ["cpu", "memory"];
    case "horizontal":
      return ["cpu", "memory"];
    case "quad":
      return ["cpu", "memory", "network", "processes"];
    default:
      return [...MONITOR_SLOT_IDS];
  }
}

export function slotRect(currentLayout: LayoutId, bounds: Rect, slotId: SlotId, primarySlot: SlotId): Rect {
  const hidden = { column: 0, row: 0, width: 0, height: 0 };
  if (bounds.width <= 0 || bounds.height <= 0) {
    return hidden;
  }

  switch (currentLayout) {
    case "single":
      return slotId === primarySlot ? bounds : hidden;
    case "vertical": {
      const leftWidth = Math.floor((bounds.width - 1) / 2);
      const rightWidth = bounds.width - leftWidth - 1;
      if (slotId === "cpu") {
        return { column: bounds.column, row: bounds.row, width: leftWidth, height: bounds.height };
      }
      if (slotId === "memory") {
        return { column: bounds.column + leftWidth + 1, row: bounds.row, width: rightWidth, height: bounds.height };
      }
      return hidden;
    }
    case "horizontal": {
      const topHeight = Math.floor((bounds.height - 1) / 2);
      const bottomHeight = bounds.height - topHeight - 1;
      if (slotId === "cpu") {
        return { column: bounds.column, row: bounds.row, width: bounds.width, height: topHeight };
      }
      if (slotId === "memory") {
        return { column: bounds.column, row: bounds.row + topHeight + 1, width: bounds.width, height: bottomHeight };
      }
      return hidden;
    }
    case "quad": {
      const leftWidth = Math.floor((bounds.width - 1) / 2);
      const rightWidth = bounds.width - leftWidth - 1;
      const topHeight = Math.floor((bounds.height - 1) / 2);
      const bottomHeight = bounds.height - topHeight - 1;
      switch (slotId) {
        case "cpu":
          return { column: bounds.column, row: bounds.row, width: leftWidth, height: topHeight };
        case "memory":
          return { column: bounds.column + leftWidth + 1, row: bounds.row, width: rightWidth, height: topHeight };
        case "network":
          return { column: bounds.column, row: bounds.row + topHeight + 1, width: leftWidth, height: bottomHeight };
        case "processes":
          return {
            column: bounds.column + leftWidth + 1,
            row: bounds.row + topHeight + 1,
            width: rightWidth,
            height: bottomHeight,
          };
        default:
          return hidden;
      }
    }
    case "monitor": {
      const [topHeight, middleHeight, bottomHeight] = weightedSplit(
        Math.max(0, bounds.height - 2),
        [29, 34, 37],
        [4, 4, 4],
      );
      const [topLeftWidth, topRightWidth] = weightedSplit(Math.max(0, bounds.width - 1), [82, 18], [12, 10]);
      const [middleLeftWidth, middleRightWidth] = weightedSplit(Math.max(0, bounds.width - 1), [56, 44], [14, 12]);
      const [tempHeight, diskHeight] = weightedSplit(Math.max(0, middleHeight - 1), [48, 52], [3, 3]);
      const [bottomLeftWidth, bottomRightWidth] = weightedSplit(Math.max(0, bounds.width - 1), [49, 51], [14, 14]);

      switch (slotId) {
        case "cpu":
          return { column: bounds.column, row: bounds.row, width: topLeftWidth, height: topHeight };
        case "cpuLegend":
          return { column: bounds.column + topLeftWidth + 1, row: bounds.row, width: topRightWidth, height: topHeight };
        case "memory":
          return {
            column: bounds.column,
            row: bounds.row + topHeight + 1,
            width: middleLeftWidth,
            height: middleHeight,
          };
        case "temperature":
          return {
            column: bounds.column + middleLeftWidth + 1,
            row: bounds.row + topHeight + 1,
            width: middleRightWidth,
            height: tempHeight,
          };
        case "disk":
          return {
            column: bounds.column + middleLeftWidth + 1,
            row: bounds.row + topHeight + 1 + tempHeight + 1,
            width: middleRightWidth,
            height: diskHeight,
          };
        case "network":
          return {
            column: bounds.column,
            row: bounds.row + topHeight + middleHeight + 2,
            width: bottomLeftWidth,
            height: bottomHeight,
          };
        case "processes":
          return {
            column: bounds.column + bottomLeftWidth + 1,
            row: bounds.row + topHeight + middleHeight + 2,
            width: bottomRightWidth,
            height: bottomHeight,
          };
        default:
          return hidden;
      }
    }
  }
}

function weightedSplit(total: number, weights: number[], minimums: number[]) {
  if (weights.length !== minimums.length || weights.length === 0) {
    return [];
  }

  const safeTotal = Math.max(0, total);
  if (safeTotal === 0) {
    return weights.map(() => 0);
  }

  const count = weights.length;
  const minimumSum = minimums.reduce((sum, value) => sum + value, 0);
  if (minimumSum >= safeTotal) {
    const base = minimums.map((value) => Math.min(value, safeTotal));
    let overflow = base.reduce((sum, value) => sum + value, 0) - safeTotal;
    for (let index = count - 1; index >= 0 && overflow > 0; index -= 1) {
      const reduction = Math.min(base[index] ?? 0, overflow);
      base[index] = (base[index] ?? 0) - reduction;
      overflow -= reduction;
    }
    return base;
  }

  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const flexible = safeTotal - minimumSum;
  const output = weights.map((weight, index) =>
    (minimums[index] ?? 0) + Math.floor(flexible * (weight / Math.max(1, weightTotal)))
  );

  let allocated = output.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (allocated < safeTotal) {
    output[index % count] = (output[index % count] ?? 0) + 1;
    allocated += 1;
    index += 1;
  }

  return output;
}
