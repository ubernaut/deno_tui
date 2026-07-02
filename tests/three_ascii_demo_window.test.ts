// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  layoutThreeAsciiDemoWindow,
  threeAsciiDemoBodyRect,
  threeAsciiDemoControlRect,
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
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 18, height: 10 }).width, 0);
});

Deno.test("three ascii demo titlebar hit testing maps compact controls", () => {
  const rect = { column: 2, row: 2, width: 78, height: 36 };
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 2), "minimize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 68, 2), "maximize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 72, 2), "restore");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 76, 2), "close");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 67, 2), undefined);
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 3), undefined);
});
