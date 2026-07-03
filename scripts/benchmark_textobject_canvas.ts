import { AnsiCanvasSink, Canvas, TextObject } from "../mod.ts";
import { Signal } from "../src/signals/mod.ts";

export interface TextObjectFullRowCanvasBenchmark {
  run(): void;
}

export function createTextObjectFullRowCanvasBenchmark(options: {
  columns: number;
  rows: number;
}): TextObjectFullRowCanvasBenchmark {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  let sinkBytes = 0;
  const sink = new AnsiCanvasSink({
    stdout: {
      writeSync(data) {
        sinkBytes += data.length;
        return data.length;
      },
    },
  });
  const canvas = new Canvas({
    sink,
    size: { columns, rows },
  });
  const frameRows = Array.from({ length: rows }, (_, row) => {
    const baseRed = (row * 11) % 256;
    const baseGreen = (64 + row * 7) % 256;
    const baseBlue = (130 + row * 5) % 256;
    return [
      `\x1b[38;2;242;236;255;48;2;${baseRed};${baseGreen};${baseBlue}m${" ".repeat(columns)}\x1b[0m`,
      `\x1b[38;2;242;236;255;48;2;${(baseRed + 37) % 256};${(baseGreen + 53) % 256};${(baseBlue + 71) % 256}m${
        "█".repeat(columns)
      }\x1b[0m`,
    ] satisfies [string, string];
  });
  const lineSignals = frameRows.map((lines, row) => {
    const signal = new Signal<string>(lines[0]);
    new TextObject({
      canvas,
      rectangle: { column: 0, row, width: columns },
      value: signal,
      overwriteRectangle: true,
      multiCodePointSupport: true,
      style: (text) => text,
      zIndex: 1,
    }).draw();
    return signal;
  });
  canvas.render();
  let frameIndex = 0;

  return {
    run() {
      frameIndex = 1 - frameIndex;
      sinkBytes = 0;
      for (let row = 0; row < rows; row += 1) {
        lineSignals[row]!.value = frameRows[row]![frameIndex];
      }
      canvas.render();
      if (sinkBytes <= rows * columns) {
        throw new Error("text object canvas workload did not flush styled full rows");
      }
    },
  };
}
