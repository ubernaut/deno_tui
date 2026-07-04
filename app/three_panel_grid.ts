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

function mixThreePanelGridHash(hash: number, value: number): number {
  return Math.imul((hash ^ value) >>> 0, 16777619) >>> 0;
}
