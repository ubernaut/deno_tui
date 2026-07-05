export function threePanelBlankGrid(width: number, height: number): string[][] {
  const columns = Math.max(0, width);
  const rows = Math.max(0, height);
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    const gridRow = new Array<string>(columns);
    for (let column = 0; column < columns; column += 1) {
      gridRow[column] = " ";
    }
    grid[row] = gridRow;
  }
  return grid;
}

export function fingerprintThreePanelGrid(grid: readonly (readonly string[] | undefined)[]): string {
  let hash = mixThreePanelGridHash(2166136261, grid.length);
  for (const row of grid) {
    const columns = row?.length ?? 0;
    hash = mixThreePanelGridHash(hash, columns);
    if (!row) continue;
    for (const cell of row) {
      hash = mixThreePanelGridHash(hash, cell.length);
      for (let index = 0; index < cell.length; index += 1) {
        hash = mixThreePanelGridHash(hash, cell.charCodeAt(index));
      }
    }
  }
  return `${grid.length}:${hash.toString(36)}`;
}

export interface ThreePanelGridPublicationInput {
  grid: readonly (readonly string[] | undefined)[];
  currentGrid?: readonly (readonly string[] | undefined)[];
  forceUpdate?: boolean;
  revision?: number;
}

/** Tracks published Three panel grid identity so unchanged renderer frames do not trigger terminal redraws. */
export class ThreePanelGridPublicationCache {
  #fingerprint = "";
  #revision?: number;

  shouldPublish(input: ThreePanelGridPublicationInput): boolean {
    const { grid, currentGrid, forceUpdate = false, revision } = input;
    if (revision !== undefined) {
      if (this.#revision === revision) return false;
      const fingerprint = fingerprintThreePanelGrid(grid);
      this.#revision = revision;
      if (this.#fingerprint === fingerprint) return false;
      this.#fingerprint = fingerprint;
      return true;
    }

    this.#revision = undefined;
    const fingerprint = fingerprintThreePanelGrid(grid);
    if (!forceUpdate && currentGrid === grid) return false;
    if (this.#fingerprint === fingerprint) return false;
    this.#fingerprint = fingerprint;
    return true;
  }

  reset(): void {
    this.#fingerprint = "";
    this.#revision = undefined;
  }
}

export interface ThreePanelGridPublishRequest {
  grid: string[][];
  currentGrid?: readonly (readonly string[] | undefined)[];
  rendererBacked?: boolean;
  revision?: number;
}

export interface ThreePanelGridPublishDecision {
  publish: boolean;
  grid: string[][];
  rendererBacked: boolean;
}

/** Owns reusable Three panel grid buffers and publication filtering. */
export class ThreePanelGridPublisher {
  readonly publication = new ThreePanelGridPublicationCache();
  #blankGridCache: string[][] = [];
  #blankGridColumns = -1;
  #blankGridRows = -1;

  blankGridFor(columns: number, rows: number): string[][] {
    if (this.#blankGridColumns === columns && this.#blankGridRows === rows) return this.#blankGridCache;
    this.#blankGridColumns = columns;
    this.#blankGridRows = rows;
    this.#blankGridCache = threePanelBlankGrid(columns, rows);
    return this.#blankGridCache;
  }

  shouldPublish(input: ThreePanelGridPublishRequest): ThreePanelGridPublishDecision {
    const rendererBacked = input.rendererBacked ?? false;
    return {
      publish: this.publication.shouldPublish({
        grid: input.grid,
        currentGrid: input.currentGrid,
        forceUpdate: rendererBacked,
        revision: input.revision,
      }),
      grid: input.grid,
      rendererBacked,
    };
  }

  reset(): void {
    this.publication.reset();
    this.#blankGridCache = [];
    this.#blankGridColumns = -1;
    this.#blankGridRows = -1;
  }
}

export function hasThreePanelGridCells(grid: readonly (readonly string[] | undefined)[]): boolean {
  return grid.length > 0 && (grid[0]?.length ?? 0) > 0;
}

function mixThreePanelGridHash(hash: number, value: number): number {
  return Math.imul((hash ^ value) >>> 0, 16777619) >>> 0;
}
