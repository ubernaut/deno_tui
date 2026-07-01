// Copyright 2023 Im-Beast. MIT license.

/** Minimal key event shape for workbench dropdown/menu navigation helpers. */
export interface WorkbenchMenuKey {
  key: string;
}

/** Options for moving a selected workbench dropdown index. */
export interface MoveWorkbenchMenuIndexOptions {
  pageSize?: number;
}

/** Return whether a key should activate the selected dropdown/menu item. */
export function isWorkbenchMenuActivationKey(key: string): boolean {
  return key === "return" || key === "space";
}

/** Return whether a key should close the active dropdown/menu. */
export function isWorkbenchMenuCloseKey(key: string): boolean {
  return key === "escape" || key === "tab";
}

/** Move a selected dropdown/menu index according to common workbench key bindings. */
export function moveWorkbenchMenuIndex(
  current: number,
  count: number,
  event: WorkbenchMenuKey,
  options: MoveWorkbenchMenuIndexOptions = {},
): number {
  if (count <= 0) return 0;
  const pageSize = Math.max(1, options.pageSize ?? 6);
  const index = ((current % count) + count) % count;
  switch (event.key) {
    case "up":
      return (index - 1 + count) % count;
    case "down":
      return (index + 1) % count;
    case "home":
      return 0;
    case "end":
      return count - 1;
    case "pageup":
      return Math.max(0, index - pageSize);
    case "pagedown":
      return Math.min(count - 1, index + pageSize);
    default:
      return index;
  }
}
