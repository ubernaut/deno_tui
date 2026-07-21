// Copyright 2023 Im-Beast. MIT license.
import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  type ScreenDefinition,
  type ScreenLifecycleEvent,
  ScreenStack,
  type ScreenStackChange,
  type ScreenStackInspection,
} from "../src/app/screens.ts";

function screens(...ids: string[]): ScreenDefinition[] {
  return ids.map((id) => ({ id, title: id.toUpperCase() }));
}

function lifecycleLabel(event: ScreenLifecycleEvent): string {
  return `${event.screenId}:${event.phase}:${event.operation}`;
}

Deno.test("screen stack push and pop preserve deterministic focus lifecycle order", () => {
  const events: string[] = [];
  const changes: Array<{ inspection: ScreenStackInspection; change: ScreenStackChange }> = [];
  const stack = new ScreenStack<ScreenDefinition, string>(screens("home", "dialog"), {
    captureFocus: (event) => {
      events.push(`capture:${event.screenId}:${event.phase}`);
      return `${event.screenId}-focus`;
    },
    restoreFocus: (token, event) => events.push(`restore:${event.screenId}:${token}`),
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });
  stack.subscribe((inspection, change) => {
    events.push(`change:${change.operation}:${inspection.activeScreenId ?? "none"}`);
    changes.push({ inspection, change });
  });

  assertEquals(stack.push("home"), true);
  events.length = 0;
  changes.length = 0;

  assertEquals(stack.push("dialog"), true);
  assertEquals(events, [
    "capture:home:suspend",
    "home:suspend:push",
    "dialog:mount:push",
    "dialog:focus:push",
    "change:push:dialog",
  ]);
  assertEquals(changes[0]!.change.screenIds, ["home", "dialog"]);

  const snapshot = stack.inspect();
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.entries));
  assert(Object.isFrozen(snapshot.entries[0]!));
  assert(Object.isFrozen(snapshot.registeredScreenIds));
  assertEquals(snapshot.entries, [
    { id: "home", title: "HOME", modal: false, state: "suspended", hasFocusToken: true },
    { id: "dialog", title: "DIALOG", modal: false, state: "active", hasFocusToken: false },
  ]);
  assertThrows(() => (snapshot.entries as unknown as unknown[]).push({}));

  events.length = 0;
  assertEquals(stack.pop(), true);
  assertEquals(events, [
    "dialog:close:pop",
    "home:resume:pop",
    "restore:home:home-focus",
    "home:focus:pop",
    "change:pop:home",
  ]);
  assertEquals(stack.inspect().entries[0]!.hasFocusToken, false);

  // Earlier snapshots remain detached from later transitions.
  assertEquals(snapshot.depth, 2);
  assertEquals(snapshot.activeScreenId, "dialog");
});

Deno.test("modal dismiss settles one typed promise after lifecycle and state subscribers", async () => {
  const events: string[] = [];
  const stack = new ScreenStack(screens("home", "confirm", "details"), {
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });
  stack.subscribe((inspection, change) => {
    events.push(`change:${change.operation}:${inspection.activeScreenId ?? "none"}`);
  });
  stack.push("home");

  const resultPromise = stack.pushModal<{ accepted: boolean }>("confirm", (result, inspection) => {
    events.push(`callback:${result?.accepted ?? false}:${inspection.activeScreenId ?? "none"}`);
  });
  assertEquals(stack.inspect().entries.at(-1)?.modal, true);
  events.length = 0;

  assertEquals(stack.dismiss("confirm", { accepted: true }), true);
  assertEquals(events, [
    "confirm:close:dismiss",
    "home:resume:dismiss",
    "home:focus:dismiss",
    "change:dismiss:home",
    "callback:true:home",
  ]);
  assertEquals(await resultPromise, { accepted: true });

  const replaced = stack.pushModal<number>("confirm");
  assertEquals(stack.replace("details"), true);
  assertEquals(await replaced, undefined);
  assertEquals(stack.active()?.id, "details");

  const popped = stack.pushModal<number>("confirm");
  assertEquals(stack.pop(7), true);
  assertEquals(await popped, 7);
  assertEquals(stack.active()?.id, "details");
});

Deno.test("replace keeps the lower stack suspended while switch reveals existing screens top-down", () => {
  const events: string[] = [];
  const stack = new ScreenStack<ScreenDefinition, string>(screens("a", "b", "c", "d"), {
    captureFocus: (event) => `${event.screenId}-token`,
    restoreFocus: (token, event) => events.push(`restore:${event.screenId}:${token}`),
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });
  stack.push("a");
  stack.push("b");
  stack.push("c");
  events.length = 0;

  assertEquals(stack.switch("a"), true);
  assertEquals(events, [
    "c:close:switch",
    "b:close:switch",
    "a:resume:switch",
    "restore:a:a-token",
    "a:focus:switch",
  ]);
  assertEquals(stack.stackIds(), ["a"]);

  stack.push("b");
  events.length = 0;
  assertEquals(stack.replace("c"), true);
  assertEquals(events, ["b:close:replace", "c:mount:replace", "c:focus:replace"]);
  assertEquals(stack.stackIds(), ["a", "c"]);

  events.length = 0;
  assertEquals(stack.switch("d"), true);
  assertEquals(events, ["c:close:switch", "d:mount:switch", "d:focus:switch"]);
  assertEquals(stack.stackIds(), ["a", "d"]);
  assertEquals(stack.switch("d"), true);
  assertEquals(stack.stackIds(), ["a", "d"]);
});

Deno.test("dismissing a suspended modal leaves the active screen untouched", async () => {
  const events: string[] = [];
  const stack = new ScreenStack(screens("home", "chooser", "editor"), {
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });
  stack.subscribe((inspection, change) => {
    events.push(`change:${change.operation}:${inspection.activeScreenId ?? "none"}`);
  });
  stack.push("home");
  const chooserResult = stack.pushModal<string>("chooser", (result, inspection) => {
    events.push(`callback:${result}:${inspection.activeScreenId}`);
  });
  stack.push("editor");
  events.length = 0;

  assertEquals(stack.dismiss("chooser", "background-result"), true);
  assertEquals(stack.stackIds(), ["home", "editor"]);
  assertEquals(stack.active()?.id, "editor");
  assertEquals(events, [
    "chooser:close:dismiss",
    "change:dismiss:editor",
    "callback:background-result:editor",
  ]);
  assertEquals(await chooserResult, "background-result");
});

Deno.test("duplicate and unknown screen operations emit bounded immutable diagnostics", () => {
  let now = 20;
  const observed: string[] = [];
  const stack = new ScreenStack<ScreenDefinition>([], {
    now: () => now++,
    maxDiagnostics: 8,
    onDiagnostic: (diagnostic) => observed.push(`${diagnostic.operation}:${diagnostic.code}`),
  });

  assertEquals(stack.register({ id: "alpha" }), true);
  assertEquals(stack.register({ id: "alpha" }), false);
  assertEquals(stack.push("missing"), false);
  assertEquals(stack.push("alpha"), true);
  assertEquals(stack.push("alpha"), false);
  assertEquals(stack.register({ id: "beta" }), true);
  assertEquals(stack.dismiss("beta"), false);
  assertEquals(stack.unregister("alpha"), false);

  assertEquals(observed, [
    "register:duplicate-screen",
    "push:unknown-screen",
    "push:duplicate-screen",
    "dismiss:screen-not-active",
    "unregister:screen-active",
  ]);
  const diagnostics = stack.diagnostics();
  assert(Object.isFrozen(diagnostics));
  assert(Object.isFrozen(diagnostics[0]!));
  assertEquals(diagnostics.map(({ code, timestamp }) => [code, timestamp]), [
    ["duplicate-screen", 20],
    ["unknown-screen", 21],
    ["duplicate-screen", 22],
    ["screen-not-active", 23],
    ["screen-active", 24],
  ]);
  assertThrows(() => (diagnostics as unknown as unknown[]).pop());
});

Deno.test("lifecycle failures are diagnosed without interrupting committed transitions", () => {
  const events: string[] = [];
  const stack = new ScreenStack([
    { id: "home" },
    {
      id: "unstable",
      onMount: () => {
        throw new Error("mount exploded");
      },
    },
  ], {
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });

  stack.push("home");
  events.length = 0;
  assertEquals(stack.push("unstable"), true);
  assertEquals(events, ["home:suspend:push", "unstable:mount:push", "unstable:focus:push"]);
  assertEquals(stack.active()?.id, "unstable");
  assertEquals(stack.inspect().lastDiagnostic?.code, "lifecycle-error");
  assertEquals(stack.inspect().lastDiagnostic?.phase, "mount");
});

Deno.test("dispose closes top-down and resolves every outstanding modal exactly once", async () => {
  const events: string[] = [];
  const stack = new ScreenStack(screens("home", "first", "second"), {
    onLifecycle: (event) => events.push(lifecycleLabel(event)),
  });
  stack.subscribe((inspection, change) => {
    events.push(`change:${change.operation}:${inspection.activeScreenId ?? "none"}`);
  });
  stack.push("home");
  const first = stack.pushModal<string>("first", (result) => events.push(`callback:first:${result}`));
  const second = stack.pushModal<string>("second", (result) => events.push(`callback:second:${result}`));
  events.length = 0;

  stack.dispose();
  stack.dispose();
  assertEquals(events, [
    "second:close:dispose",
    "first:close:dispose",
    "home:close:dispose",
    "change:dispose:none",
    "callback:second:undefined",
    "callback:first:undefined",
  ]);
  assertEquals(await Promise.all([first, second]), [undefined, undefined]);
  assertEquals(stack.inspect().disposed, true);
  assertEquals(stack.inspect().depth, 0);
  assertEquals(stack.inspect().registeredCount, 0);
  assertEquals(stack.push("home"), false);
  assertEquals(stack.inspect().lastDiagnostic?.code, "disposed");
});
