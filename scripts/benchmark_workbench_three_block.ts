import {
  prepareWorkbenchFrame,
  renderFrameRow,
  renderFrameSlice,
  WorkbenchAnsiScreenPainter,
  type WorkbenchFrame,
  writeFrame,
  writeFrameCells,
} from "../mod.ts";

export interface WorkbenchThreeBlockFlushBenchmark {
  run(): void;
}

export function createWorkbenchThreeBlockFlushBenchmark(options: {
  frameWidth: number;
  frameRows: number;
  panelColumn: number;
  panelRow: number;
  panelWidth: number;
  panelRows: number;
}): WorkbenchThreeBlockFlushBenchmark {
  const frameWidth = Math.max(1, Math.floor(options.frameWidth));
  const frameRows = Math.max(1, Math.floor(options.frameRows));
  const panelColumn = Math.max(0, Math.floor(options.panelColumn));
  const panelRow = Math.max(0, Math.floor(options.panelRow));
  const panelWidth = Math.max(1, Math.floor(options.panelWidth));
  const panelRows = Math.max(1, Math.floor(options.panelRows));
  const frame: WorkbenchFrame = [];
  const panelCells = new Array<string>(panelWidth);
  let wave = 0;
  let checksum = 0;
  let bytesWritten = 0;
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      bytesWritten += data.byteLength;
      return data.byteLength;
    },
  });

  return {
    run() {
      wave = (wave + 1) % 64;
      const prepared = prepareWorkbenchFrame(frame, frameRows);
      for (let row = 0; row < frameRows; row += 1) {
        writeFrame(
          prepared,
          frameWidth,
          row,
          0,
          `\x1b[38;2;210;220;235;48;2;8;6;18m${"WORKBENCH ".repeat(17)}\x1b[0m`,
        );
      }

      for (let row = 0; row < panelRows; row += 1) {
        const outputRow = panelRow + row;
        for (let column = 0; column < panelWidth; column += 1) {
          const red = (column * 9 + row * 5 + wave * 7) % 256;
          const green = (96 + column * 3 + row * 11 + wave * 13) % 256;
          const blue = (180 + column * 7 + row * 2 + wave * 5) % 256;
          panelCells[column] = `\x1b[48;2;${red};${green};${blue}m \x1b[0m`;
        }
        writeFrameCells(prepared[outputRow]!, panelColumn, panelCells);
      }

      const first = painter.flush(prepared, frameWidth, frameRows, renderFrameRow, renderFrameSlice);
      const second = painter.flush(prepared, frameWidth, frameRows, renderFrameRow, renderFrameSlice);
      checksum = (checksum + first.changed + first.bytes + second.changed + second.bytes) % 1_000_000;
      if (
        (first.changed !== panelRows && first.changed !== frameRows) ||
        first.bytes <= 0 ||
        first.bytes >= frameRows * frameWidth * 12 ||
        second.changed !== 0 ||
        second.bytes !== 0 ||
        !Number.isFinite(checksum + bytesWritten)
      ) {
        throw new Error("workbench Three block span flush workload failed");
      }
    },
  };
}
