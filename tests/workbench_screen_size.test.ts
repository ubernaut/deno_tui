import { assertEquals } from "./deps.ts";
import {
  syncWorkbenchTerminalSize,
  workbenchScreenHeight,
  type WorkbenchScreenSizeTarget,
  workbenchScreenWidth,
} from "../src/app/workbench_screen_size.ts";

Deno.test("syncWorkbenchTerminalSize reports unchanged terminal size", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => ({ columns: 80, rows: 24 }));

  assertEquals(result, { changed: false, size: { columns: 80, rows: 24 } });
  assertEquals(target.writes, 0);
});

Deno.test("syncWorkbenchTerminalSize writes normalized changed size", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => ({ columns: 120.9, rows: 36.2 }));

  assertEquals(result, { changed: true, size: { columns: 120, rows: 36 } });
  assertEquals(target.peek(), { columns: 120, rows: 36 });
  assertEquals(target.writes, 1);
});

Deno.test("syncWorkbenchTerminalSize keeps current size when reading fails", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => {
    throw new Error("not a tty");
  });

  assertEquals(result.changed, false);
  assertEquals(result.size, { columns: 80, rows: 24 });
  assertEquals(result.error instanceof Error, true);
  assertEquals(target.writes, 0);
});

Deno.test("workbench screen dimension helpers clamp invalid rectangles", () => {
  assertEquals(workbenchScreenWidth({ width: 150.9 }), 150);
  assertEquals(workbenchScreenHeight({ height: 46.8 }), 46);
  assertEquals(workbenchScreenWidth({ width: 0 }), 1);
  assertEquals(workbenchScreenHeight({ height: -10 }), 1);
});

function fakeSizeTarget(initial: { columns: number; rows: number }): WorkbenchScreenSizeTarget & { writes: number } {
  let current = { ...initial };
  return {
    writes: 0,
    peek: () => current,
    get value() {
      return current;
    },
    set value(next) {
      this.writes += 1;
      current = next;
    },
  };
}
