// Copyright 2023 Im-Beast. MIT license.
export type Disposer = () => void;
export type MaybeDisposer = Disposer | void | undefined;

export interface DisposableStackInspection {
  disposed: boolean;
  size: number;
}

export class DisposableStack {
  #disposed = false;
  readonly #disposers: Disposer[] = [];

  constructor(disposers: Iterable<MaybeDisposer> = []) {
    for (const disposer of disposers) {
      this.defer(disposer);
    }
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get size(): number {
    return this.#disposers.length;
  }

  defer(disposer: MaybeDisposer): Disposer {
    if (!disposer) return noop;

    let active = true;
    const wrapped = () => {
      if (!active) return;
      active = false;
      const index = this.#disposers.indexOf(wrapped);
      if (index >= 0) this.#disposers.splice(index, 1);
      disposer();
    };

    if (this.#disposed) {
      wrapped();
    } else {
      this.#disposers.push(wrapped);
    }

    return wrapped;
  }

  dispose = (): void => {
    if (this.#disposed) return;
    this.#disposed = true;
    const disposers = [...this.#disposers].reverse();
    this.#disposers.length = 0;
    for (const dispose of disposers) {
      dispose();
    }
  };

  inspect(): DisposableStackInspection {
    return {
      disposed: this.#disposed,
      size: this.#disposers.length,
    };
  }
}

export function createDisposableStack(disposers: Iterable<MaybeDisposer> = []): DisposableStack {
  return new DisposableStack(disposers);
}

export function disposeReverse(disposers: Iterable<MaybeDisposer>): void {
  createDisposableStack(disposers).dispose();
}

function noop(): void {}
