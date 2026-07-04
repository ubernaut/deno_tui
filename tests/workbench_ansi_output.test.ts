import { assertEquals } from "./deps.ts";
import { writeWorkbenchAnsiScreenOutput } from "../src/app/workbench_ansi_output.ts";

Deno.test("writeWorkbenchAnsiScreenOutput returns zero-byte stats without writing empty output", () => {
  let writes = 0;
  const stats = writeWorkbenchAnsiScreenOutput(
    {
      writeSync(data) {
        writes += 1;
        return data.byteLength;
      },
    },
    [],
    { rows: 2, changed: 0, cleared: 0 },
  );

  assertEquals(stats, { rows: 2, changed: 0, cleared: 0, bytes: 0, durationMs: 0 });
  assertEquals(writes, 0);
});

Deno.test("writeWorkbenchAnsiScreenOutput writes joined ANSI chunks and reports bytes", () => {
  const chunks: Uint8Array[] = [];
  const stats = writeWorkbenchAnsiScreenOutput(
    {
      writeSync(data) {
        chunks.push(data);
        return data.byteLength;
      },
    },
    ["\x1b[1;1H", "AB", "\x1b[2;1H", "CD"],
    { rows: 2, changed: 2, cleared: 0 },
  );

  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;1HAB\x1b[2;1HCD");
  assertEquals(stats.rows, 2);
  assertEquals(stats.changed, 2);
  assertEquals(stats.cleared, 0);
  assertEquals(stats.bytes, chunks[0]!.byteLength);
  assertEquals(stats.durationMs >= 0, true);
});
