export interface ThreePanelValueSignal<T> {
  peek(): T;
}

export type ThreePanelResolvableValue<T> = T | ThreePanelValueSignal<T>;
export type ThreePanelResolvableLiveValue = boolean | ThreePanelValueSignal<boolean> | (() => boolean);

export function resolveThreePanelValue<T>(value: ThreePanelResolvableValue<T>): T {
  return isThreePanelValueSignal(value) ? value.peek() : value;
}

export function resolveOptionalThreePanelValue<T>(
  value: ThreePanelResolvableValue<T> | undefined,
): T | undefined {
  return value === undefined ? undefined : resolveThreePanelValue(value);
}

export function resolveThreePanelLiveValue(value: ThreePanelResolvableLiveValue | undefined): boolean {
  if (value === undefined) return true;
  if (isThreePanelValueSignal(value)) return value.peek();
  if (typeof value === "function") return value();
  return value;
}

function isThreePanelValueSignal<T>(value: unknown): value is ThreePanelValueSignal<T> {
  return typeof value === "object" && value !== null && typeof (value as { peek?: unknown }).peek === "function";
}
