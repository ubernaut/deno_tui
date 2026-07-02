import { assertEquals } from "./deps.ts";
import { createMouseInteractionRouter } from "../src/app/mouse_bindings.ts";
import type { MousePressEvent } from "../src/input_reader/types.ts";

Deno.test("mouse interaction router resolves dynamic hit bounds once per dispatch", async () => {
  const router = createMouseInteractionRouter();
  let boundsCalls = 0;
  const handled: Array<{ id: string; localX: number; localY: number }> = [];

  router.register({
    id: "button",
    bounds: () => {
      boundsCalls += 1;
      return { column: 10, row: 4, width: 8, height: 3 };
    },
    onPress: (_event, context) => {
      handled.push({ id: context.id, localX: context.localX, localY: context.localY });
    },
  });

  assertEquals(await router.dispatch(mousePress(12, 6)), {
    handled: true,
    targetId: "button",
    kind: "press",
    captured: false,
  });
  assertEquals(boundsCalls, 1);
  assertEquals(handled, [{ id: "button", localX: 2, localY: 2 }]);
});

Deno.test("mouse interaction router keeps z-order and capture semantics", async () => {
  const router = createMouseInteractionRouter();
  const events: string[] = [];

  router.register({
    id: "under",
    bounds: { column: 0, row: 0, width: 10, height: 5 },
    zIndex: 1,
    onPress: () => {
      events.push("under:press");
    },
  });
  router.register({
    id: "top",
    bounds: { column: 0, row: 0, width: 10, height: 5 },
    zIndex: 2,
    onPress: () => {
      events.push("top:press");
    },
    onDrag: () => {
      events.push("top:drag");
    },
    onRelease: () => {
      events.push("top:release");
    },
  });

  assertEquals((await router.dispatch(mousePress(1, 1))).targetId, "top");
  assertEquals(router.captured(), "top");
  assertEquals((await router.dispatch(mousePress(20, 20, { drag: true }))).captured, true);
  assertEquals((await router.dispatch(mousePress(20, 20, { release: true }))).captured, true);
  assertEquals(router.captured(), undefined);
  assertEquals(events, ["top:press", "top:drag", "top:release"]);
});

function mousePress(x: number, y: number, options: Partial<MousePressEvent> = {}): MousePressEvent {
  return {
    key: "mouse",
    buffer: new Uint8Array(),
    x,
    y,
    button: 0,
    movementX: 0,
    movementY: 0,
    drag: false,
    release: false,
    meta: false,
    ctrl: false,
    shift: false,
    ...options,
  };
}
