// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  layoutThreeAsciiDemoWindow,
  THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT,
  THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT,
  threeAsciiDemoBodyRect,
  threeAsciiDemoControlRect,
  threeAsciiDemoControlText,
  threeAsciiDemoSidePanelVisible,
  threeAsciiDemoTitlebarControlAt,
  threeAsciiDemoTitleRect,
} from "../app/three_ascii_demo_window.ts";

Deno.test("three ascii demo window reserves side panel only when useful", () => {
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: false, maximized: false }), true);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: true, maximized: false }), false);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: false, maximized: true }), false);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: false, minimized: false, maximized: false }), false);

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 120,
      terminalHeight: 40,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 78, height: 36 },
  );

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 60,
      terminalHeight: 20,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 56, height: 16 },
  );

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 80,
      terminalHeight: 24,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 76, height: 20 },
  );
});

Deno.test("three ascii demo window derives body title and control rectangles", () => {
  const rect = { column: 2, row: 2, width: 78, height: 36 };
  assertEquals(threeAsciiDemoBodyRect(rect), { column: 3, row: 3, width: 76, height: 34 });
  assertEquals(threeAsciiDemoTitleRect(rect), { column: 4, row: 2, width: 59, height: 1 });
  assertEquals(threeAsciiDemoControlRect(rect), { column: 64, row: 2, width: 15, height: 1 });

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 120,
      terminalHeight: 40,
      menuVisible: true,
      minimized: true,
      maximized: false,
    }).height,
    3,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 18, height: 10 }), {
    column: 4,
    row: 2,
    width: 15,
    height: 1,
  });
  assertEquals(
    threeAsciiDemoControlText({ column: 2, row: 2, width: 18, height: 10 }),
    THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 16, height: 10 }), {
    column: 5,
    row: 2,
    width: 12,
    height: 1,
  });
  assertEquals(
    threeAsciiDemoControlText({ column: 2, row: 2, width: 16, height: 10 }),
    THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 13, height: 10 }).width, 0);
});

Deno.test("three ascii demo titlebar hit testing maps compact controls", () => {
  const rect = { column: 2, row: 2, width: 78, height: 36 };
  assertEquals(/^[\x20-\x7e]+$/.test(THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT), true);
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 2), "minimize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 68, 2), "maximize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 72, 2), "restore");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 76, 2), "close");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 67, 2), undefined);
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 3), undefined);
});

Deno.test("three ascii demo titlebar keeps compact controls addressable in narrow windows", () => {
  const rect = { column: 2, row: 2, width: 16, height: 10 };
  assertEquals(threeAsciiDemoControlText(rect), "[-][M][R][x]");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 5, 2), "minimize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 8, 2), "maximize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 11, 2), "restore");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 14, 2), "close");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 4, 2), undefined);
});
