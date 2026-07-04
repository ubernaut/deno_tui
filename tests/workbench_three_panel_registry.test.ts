import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  type WorkbenchThreePanelEntry,
  WorkbenchThreePanelRegistry,
} from "../src/app/workbench_three_panel_registry.ts";
import type { WorkbenchThreeScene } from "../app/workbench_three_scene.ts";
import type { Rectangle } from "../src/types.ts";

Deno.test("WorkbenchThreePanelRegistry lazily creates and reuses panel entries", () => {
  let created = 0;
  const registry = new WorkbenchThreePanelRegistry((id: string) => {
    created += 1;
    return fakeEntry(id);
  });

  const first = registry.ensure("viz:one");
  const second = registry.ensure("viz:one");

  assertStrictEquals(first, second);
  assertEquals(created, 1);
  assertEquals(registry.get("viz:one"), first);
});

Deno.test("WorkbenchThreePanelRegistry hides panels outside the visible set", () => {
  const registry = new WorkbenchThreePanelRegistry(fakeEntry);
  const visible = registry.ensure("viz:visible");
  const hidden = registry.ensure("viz:hidden");

  registry.hideExcept(new Set(["viz:visible"]));

  assertEquals(visible.scene.peek()?.mode, "studio");
  assertEquals(visible.rectangle.peek(), { column: 2, row: 3, width: 4, height: 5 });
  assertEquals(hidden.scene.peek(), null);
  assertEquals(hidden.rectangle.peek(), { column: 0, row: 0, width: 0, height: 0 });
  assertEquals(hidden.graphicsRectangle.peek(), { column: 0, row: 0, width: 0, height: 0 });
});

Deno.test("WorkbenchThreePanelRegistry disposes individual entries and clears all entries", () => {
  const registry = new WorkbenchThreePanelRegistry(fakeEntry);
  const one = registry.ensure("viz:one");
  const two = registry.ensure("viz:two");

  registry.dispose("viz:one");
  assertEquals(one.panel.disposed, 1);
  assertEquals((one.scene as FakeSignal<WorkbenchThreeScene | null>).disposed, 1);
  assertEquals(registry.get("viz:one"), undefined);
  assertEquals(two.panel.disposed, 0);

  registry.clear();
  assertEquals(two.panel.disposed, 1);
  assertEquals((two.scene as FakeSignal<WorkbenchThreeScene | null>).disposed, 1);
  assertEquals(registry.entries.size, 0);
});

function fakeEntry(id: string): WorkbenchThreePanelEntry<FakePanel, WorkbenchThreeScene> {
  return {
    rectangle: new FakeSignal({ column: 2, row: 3, width: 4, height: 5 }),
    graphicsRectangle: new FakeSignal({ column: 8, row: 9, width: 10, height: 11 }),
    scene: new FakeSignal<WorkbenchThreeScene | null>({
      mode: "studio",
      signal: {
        x: id.length,
        y: 0,
        depth: 0,
        twist: 0,
        lift: 0,
        pulse: 0,
        active: true,
        pressed: false,
      },
    }),
    panel: new FakePanel(),
  };
}

class FakePanel {
  disposed = 0;

  dispose(): void {
    this.disposed += 1;
  }
}

class FakeSignal<T> {
  disposed = 0;

  constructor(private current: T) {}

  peek(): T {
    return this.current;
  }

  set value(next: T) {
    this.current = next;
  }

  dispose(): void {
    this.disposed += 1;
  }
}
