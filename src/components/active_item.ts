// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

export interface ActiveItem {
  disabled?: boolean;
}

export interface ActiveItemIndexPolicy {
  emptyIndex: number;
  wrap: boolean;
  clampStart?: boolean;
}

export const WRAPPED_ACTIVE_ITEM_INDEX_POLICY: ActiveItemIndexPolicy = { emptyIndex: -1, wrap: true };
export const BOUNDED_ACTIVE_ITEM_INDEX_POLICY: ActiveItemIndexPolicy = { emptyIndex: 0, wrap: false };

interface ActiveItemControllerOptions<TItem extends ActiveItem> {
  items: TItem[] | Signal<TItem[]>;
  activeIndex?: number | Signal<number>;
  policy: ActiveItemIndexPolicy;
  onChange?: (item: TItem, index: number) => void | Promise<void>;
}

interface ActiveItemKeyEvent {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export function shiftActiveItemIndex<TItem extends ActiveItem>(
  items: readonly TItem[],
  activeIndex: number,
  delta: number,
  policy: ActiveItemIndexPolicy,
): number {
  if (items.length === 0) return policy.emptyIndex;
  let next = policy.clampStart === false ? activeIndex : clampIndex(items.length, activeIndex);
  for (let count = 0; count < items.length; count += 1) {
    next = policy.wrap ? (next + delta + items.length) % items.length : clampIndex(items.length, next + delta);
    if (!items[next]?.disabled) return next;
    if (!policy.wrap && (next === 0 || next === items.length - 1)) break;
  }
  return activeIndex;
}

export function clampActiveItemIndex<TItem extends ActiveItem>(
  items: readonly TItem[],
  activeIndex: number,
  policy: ActiveItemIndexPolicy,
): number {
  if (items.length === 0) return policy.emptyIndex;
  const clamped = clampIndex(items.length, activeIndex);
  if (!items[clamped]?.disabled) return clamped;
  const next = shiftActiveItemIndex(items, clamped, 1, policy);
  if (!items[next]?.disabled) return next;
  const previous = shiftActiveItemIndex(items, clamped, -1, policy);
  return items[previous]?.disabled ? clamped : previous;
}

export function activeItemForIndex<TItem extends ActiveItem>(
  items: readonly TItem[],
  activeIndex: number,
  policy: ActiveItemIndexPolicy,
): TItem | undefined {
  const item = items[clampActiveItemIndex(items, activeIndex, policy)];
  return item?.disabled ? undefined : item;
}

export function cloneActiveItems<TItem extends ActiveItem>(items: readonly TItem[]): TItem[] {
  const clone = new Array<TItem>(items.length);
  for (let index = 0; index < items.length; index += 1) clone[index] = { ...items[index]! };
  return clone;
}

export class ActiveItemController<TItem extends ActiveItem> {
  protected readonly activeItems: Signal<TItem[]>;
  readonly activeIndex: Signal<number>;
  readonly #policy: ActiveItemIndexPolicy;
  readonly #ownsItems: boolean;
  readonly #ownsActiveIndex: boolean;
  readonly #onChange?: (item: TItem, index: number) => void | Promise<void>;

  constructor(options: ActiveItemControllerOptions<TItem>) {
    this.#policy = options.policy;
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsActiveIndex = !(options.activeIndex instanceof Signal);
    this.activeItems = signalify(options.items, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);
    this.#onChange = options.onChange;
    this.activeIndex.value = this.clampIndex(this.activeIndex.peek());
  }

  active(): TItem | undefined {
    return activeItemForIndex(this.activeItems.peek(), this.activeIndex.peek(), this.#policy);
  }

  move(delta: number): TItem | undefined {
    return this.setActive(
      shiftActiveItemIndex(this.activeItems.peek(), this.activeIndex.peek(), delta, this.#policy),
    );
  }

  first(): TItem | undefined {
    return this.setActive(0);
  }

  last(): TItem | undefined {
    return this.setActive(this.activeItems.peek().length - 1);
  }

  setActive(index: number): TItem | undefined {
    const next = this.clampIndex(index);
    this.activeIndex.value = next;
    const item = this.activeItems.peek()[next];
    if (!item || item.disabled) return undefined;
    void this.#onChange?.(item, next);
    return item;
  }

  handleKeyPress({ key, ctrl, meta, shift }: ActiveItemKeyEvent): void {
    if (ctrl || meta || shift) return;
    const axis = this.keyAxis();
    if (key === (axis === "horizontal" ? "left" : "up")) {
      this.move(-1);
    } else if (key === (axis === "horizontal" ? "right" : "down")) {
      this.move(1);
    } else if (key === "home") {
      this.first();
    } else if (key === "end") {
      this.last();
    } else if (this.selectsOnKeyPress() && (key === "return" || key === "space")) {
      this.selectActiveFromKey();
    }
    this.afterKeyPress();
  }

  dispose(): void {
    if (this.#ownsItems) this.activeItems.dispose();
    if (this.#ownsActiveIndex) this.activeIndex.dispose();
  }

  protected clampIndex(index: number): number {
    return clampActiveItemIndex(this.activeItems.peek(), index, this.#policy);
  }

  protected keyAxis(): "horizontal" | "vertical" {
    return "horizontal";
  }

  protected selectsOnKeyPress(): boolean {
    return false;
  }

  protected selectActiveFromKey(): void {}

  protected afterKeyPress(): void {}
}

function clampIndex(length: number, index: number): number {
  return Math.max(0, Math.min(index, length - 1));
}
