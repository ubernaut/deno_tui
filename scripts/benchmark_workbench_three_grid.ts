import { prepareWorkbenchFrame, renderFrameRow, type WorkbenchFrame } from "../mod.ts";
import { writeWorkbenchThreeGrid } from "../app/workbench_three_grid.ts";

export interface WorkbenchThreeGridBenchmark {
  runScaled(): void;
  runCapped(): void;
  runVerticalOnly(): void;
}

export function createWorkbenchThreeGridBenchmark(options: {
  sourceColumns: number;
  sourceRows: number;
  targetColumns: number;
  targetRows: number;
}): WorkbenchThreeGridBenchmark {
  const sourceColumns = Math.max(1, Math.floor(options.sourceColumns));
  const sourceRows = Math.max(1, Math.floor(options.sourceRows));
  const targetColumns = Math.max(1, Math.floor(options.targetColumns));
  const targetRows = Math.max(1, Math.floor(options.targetRows));
  const frame: WorkbenchFrame = [];
  const rowBuffer: string[] = [];
  const sourceRowIndexes: number[] = [];
  const sourceColumnIndexes: number[] = [];
  const grid = Array.from(
    { length: sourceRows },
    (_, row) =>
      Array.from({ length: sourceColumns }, (_, column) => {
        const red = (row * 17 + column * 11) % 256;
        const green = (64 + row * 7 + column * 13) % 256;
        const blue = (160 + row * 5 + column * 3) % 256;
        return `\x1b[48;2;${red};${green};${blue}m \x1b[0m`;
      }),
  );
  let checksum = 0;

  function checksumFrame(errorMessage: string, width = targetColumns, rows = targetRows): void {
    let total = 0;
    for (let row = 0; row < rows; row += 1) {
      total += renderFrameRow(frame[row] ?? [], width).length;
    }
    checksum = (checksum + total) % 1_000_000;
    if (!Number.isFinite(checksum)) {
      throw new Error(errorMessage);
    }
  }

  return {
    runScaled() {
      const preparedFrame = prepareWorkbenchFrame(frame, targetRows);
      writeWorkbenchThreeGrid(
        preparedFrame,
        { column: 0, row: 0, width: targetColumns, height: targetRows },
        grid,
        " ",
        {
          scale: true,
          rowBuffer,
          sourceColumns,
          sourceRowIndexes,
          sourceColumnIndexes,
        },
      );
      checksumFrame("workbench scaled Three grid checksum failed");
    },

    runCapped() {
      const preparedFrame = prepareWorkbenchFrame(frame, targetRows);
      writeWorkbenchThreeGrid(
        preparedFrame,
        { column: 0, row: 0, width: targetColumns, height: targetRows },
        grid,
        "\x1b[48;2;8;6;18m \x1b[0m",
        {
          scale: "down",
          rowBuffer,
          sourceColumns,
          sourceRowIndexes,
          sourceColumnIndexes,
        },
      );
      checksumFrame("workbench capped Three grid checksum failed");
    },

    runVerticalOnly() {
      const preparedFrame = prepareWorkbenchFrame(frame, targetRows);
      writeWorkbenchThreeGrid(
        preparedFrame,
        { column: 0, row: 0, width: sourceColumns, height: targetRows },
        grid,
        " ",
        {
          scale: true,
          rowBuffer,
          sourceColumns,
          sourceRowIndexes,
        },
      );
      checksumFrame("workbench vertical-only Three grid checksum failed", sourceColumns, targetRows);
    },
  };
}
