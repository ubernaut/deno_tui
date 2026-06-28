// Copyright 2023 Im-Beast. MIT license.
export interface HistoryTransaction {
  id?: string;
  label: string;
  group?: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export interface HistoryStackOptions {
  capacity?: number;
}

export interface HistoryInspection {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  nextUndo?: HistoryEntryInspection;
  nextRedo?: HistoryEntryInspection;
}

export interface HistoryEntryInspection {
  id?: string;
  label: string;
  group?: string;
}

export class HistoryStack {
  readonly #undoStack: HistoryTransaction[] = [];
  readonly #redoStack: HistoryTransaction[] = [];
  readonly #capacity: number;

  constructor(options: HistoryStackOptions = {}) {
    this.#capacity = Math.max(1, Math.floor(options.capacity ?? 100));
  }

  get undoDepth(): number {
    return this.#undoStack.length;
  }

  get redoDepth(): number {
    return this.#redoStack.length;
  }

  canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  push(transaction: HistoryTransaction): void {
    this.#undoStack.push(transaction);
    while (this.#undoStack.length > this.#capacity) {
      this.#undoStack.shift();
    }
    this.#redoStack.length = 0;
  }

  async apply(transaction: HistoryTransaction): Promise<void> {
    await transaction.redo();
    this.push(transaction);
  }

  async undo(): Promise<boolean> {
    const transaction = this.#undoStack.pop();
    if (!transaction) return false;
    await transaction.undo();
    this.#redoStack.push(transaction);
    return true;
  }

  async redo(): Promise<boolean> {
    const transaction = this.#redoStack.pop();
    if (!transaction) return false;
    await transaction.redo();
    this.#undoStack.push(transaction);
    return true;
  }

  clear(): void {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
  }

  inspect(): HistoryInspection {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDepth: this.undoDepth,
      redoDepth: this.redoDepth,
      nextUndo: inspectEntry(this.#undoStack.at(-1)),
      nextRedo: inspectEntry(this.#redoStack.at(-1)),
    };
  }
}

function inspectEntry(transaction: HistoryTransaction | undefined): HistoryEntryInspection | undefined {
  return transaction
    ? {
      id: transaction.id,
      label: transaction.label,
      group: transaction.group,
    }
    : undefined;
}
