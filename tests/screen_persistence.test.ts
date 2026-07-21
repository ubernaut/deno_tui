// Copyright 2023 Im-Beast. MIT license.
import { assert, assertEquals, assertMatch, assertThrows } from "./deps.ts";
import {
  dryRunScreenStackRestore,
  restoreScreenStackSnapshot,
  SCREEN_STACK_SNAPSHOT_SCHEMA,
  SCREEN_STACK_SNAPSHOT_VERSION,
  type ScreenPersistenceOptions,
  type ScreenPersistenceResult,
  snapshotScreenStack,
} from "../src/app/screen_persistence.ts";
import { type ScreenDefinition, ScreenStack } from "../src/app/screens.ts";

function definitions(...ids: string[]): ScreenDefinition[] {
  return ids.map((id) => ({ id, title: id.toUpperCase() }));
}

function restorable(...ids: string[]): ScreenPersistenceOptions["screens"] {
  return Object.fromEntries(ids.map((id) => [id, { restorable: true }]));
}

function expectValue<T>(result: ScreenPersistenceResult<T>): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`expected successful persistence result: ${JSON.stringify(result.diagnostics)}`);
  }
  return result.value;
}

function codes(result: ScreenPersistenceResult<unknown>): string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

function lifecycleLabel(screenId: string, phase: string, operation: string): string {
  return `${screenId}:${phase}:${operation}`;
}

Deno.test("screen snapshots are versioned clone-safe and default to denying restoration", () => {
  const stack = new ScreenStack<ScreenDefinition, string>(definitions("home", "settings"), {
    captureFocus: (event) => `${event.screenId}-focus-token`,
  });
  stack.push("home");
  stack.push("settings");
  assertEquals(stack.inspect().entries[0]!.hasFocusToken, true);

  const mode = "  編輯/🧪  ";
  const denied = snapshotScreenStack(stack, { mode, registryVersion: "app@3" });
  assertEquals(denied.ok, false);
  assertEquals(codes(denied), ["non-restorable-screen", "non-restorable-screen"]);

  const options: ScreenPersistenceOptions = {
    mode,
    registryVersion: "app@3",
    screens: restorable("home", "settings"),
  };
  const snapshot = expectValue(snapshotScreenStack(stack, options));
  assertEquals(snapshot.schema, SCREEN_STACK_SNAPSHOT_SCHEMA);
  assertEquals(snapshot.version, SCREEN_STACK_SNAPSHOT_VERSION);
  assertEquals(snapshot.mode, mode);
  assertEquals(snapshot.registry.version, "app@3");
  assertMatch(snapshot.registry.fingerprint, /^fnv1a32:[0-9a-f]{8}$/);
  assertEquals(snapshot.screens, ["home", "settings"]);
  assertEquals(Object.keys(snapshot), ["schema", "version", "mode", "registry", "screens"]);
  assertEquals(Object.keys(snapshot.registry), ["version", "fingerprint"]);
  assertEquals(JSON.stringify(snapshot).includes("focus-token"), false);
  assertEquals(JSON.stringify(snapshot).includes("onMount"), false);

  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.registry));
  assert(Object.isFrozen(snapshot.screens));
  assertThrows(() => (snapshot.screens as unknown as string[]).push("mutated"));

  const transportClone = structuredClone(snapshot) as unknown as { screens: string[]; mode: string };
  transportClone.screens[0] = "mutated";
  transportClone.mode = "mutated";
  assertEquals(snapshot.screens, ["home", "settings"]);
  assertEquals(snapshot.mode, mode);
  assertEquals(stack.stackIds(), ["home", "settings"]);
});

Deno.test("dry-run plans a common-prefix restore and restore follows public lifecycle transitions", () => {
  const events: string[] = [];
  const target = new ScreenStack(definitions("a", "b", "c", "d"), {
    onLifecycle: (event) => events.push(lifecycleLabel(event.screenId, event.phase, event.operation)),
  });
  target.push("a");
  target.push("b");
  target.push("d");

  // Register in a different order to prove registry fingerprints are order-independent.
  const source = new ScreenStack(definitions("d", "c", "b", "a"));
  source.push("a");
  source.push("c");
  const options: ScreenPersistenceOptions = {
    mode: "workspace",
    registryVersion: "screens@1",
    screens: restorable("a", "b", "c", "d"),
  };
  const snapshot = expectValue(snapshotScreenStack(source, options));
  events.length = 0;

  const dryRun = expectValue(dryRunScreenStackRestore(target, snapshot, options));
  assertEquals(target.stackIds(), ["a", "b", "d"]);
  assertEquals(events, []);
  assertEquals(dryRun.commonPrefixLength, 1);
  assertEquals(dryRun.closeScreenIds, ["d", "b"]);
  assertEquals(dryRun.mountScreenIds, ["c"]);
  assertEquals(dryRun.transitions, [
    { operation: "switch", screenId: "a" },
    { operation: "push", screenId: "c" },
  ]);
  assert(Object.isFrozen(dryRun));
  assert(Object.isFrozen(dryRun.transitions));

  const restored = expectValue(restoreScreenStackSnapshot(target, snapshot, options));
  assertEquals(restored.applied, true);
  assertEquals(target.stackIds(), ["a", "c"]);
  assertEquals(events, [
    "d:close:switch",
    "b:close:switch",
    "a:resume:switch",
    "a:focus:switch",
    "a:suspend:push",
    "c:mount:push",
    "c:focus:push",
  ]);

  events.length = 0;
  const noOp = expectValue(restoreScreenStackSnapshot(target, snapshot, options));
  assertEquals(noOp.applied, false);
  assertEquals(noOp.plan.noOp, true);
  assertEquals(events, []);
});

Deno.test("corrupt duplicate unknown and resource-shaped snapshots fail without mutation", () => {
  const observed: unknown[] = [];
  const stack = new ScreenStack(definitions("home", "settings"));
  stack.push("home");
  const options: ScreenPersistenceOptions = {
    mode: "main",
    registryVersion: "registry@1",
    screens: restorable("home", "settings"),
    onDiagnostic: (diagnostic) => observed.push(diagnostic),
  };
  const valid = expectValue(snapshotScreenStack(stack, options));

  const extraField = structuredClone(valid) as unknown as Record<string, unknown>;
  extraField.focusTokens = ["secret"];
  const extraResult = restoreScreenStackSnapshot(stack, extraField, options);
  assertEquals(codes(extraResult), ["unknown-field"]);
  assertEquals(stack.stackIds(), ["home"]);

  const duplicate = structuredClone(valid) as unknown as { screens: string[] };
  duplicate.screens = ["home", "home"];
  const duplicateResult = dryRunScreenStackRestore(stack, duplicate, options);
  assertEquals(codes(duplicateResult), ["duplicate-screen"]);
  assertEquals(stack.stackIds(), ["home"]);

  const unknown = structuredClone(valid) as unknown as { screens: string[] };
  unknown.screens = ["ghost"];
  const unknownResult = restoreScreenStackSnapshot(stack, unknown, options);
  assertEquals(codes(unknownResult), ["unknown-screen"]);
  assertEquals(stack.stackIds(), ["home"]);

  const callbackShaped = structuredClone(valid) as unknown as Record<string, unknown>;
  callbackShaped.onResult = () => undefined;
  const callbackResult = restoreScreenStackSnapshot(stack, callbackShaped, options);
  assertEquals(codes(callbackResult), ["unsafe-value"]);
  assertEquals(stack.stackIds(), ["home"]);

  const future = structuredClone(valid) as unknown as { version: number };
  future.version = SCREEN_STACK_SNAPSHOT_VERSION + 1;
  const futureResult = dryRunScreenStackRestore(stack, future, options);
  assertEquals(codes(futureResult), ["unsupported-version"]);
  assertEquals(stack.stackIds(), ["home"]);
  assert(observed.every(Object.isFrozen));
});

Deno.test("registry drift and non-restorable snapshot entries are rejected during preflight", () => {
  const source = new ScreenStack(definitions("home", "settings"));
  source.push("home");
  const sourceOptions: ScreenPersistenceOptions = {
    mode: "main",
    registryVersion: "registry@1",
    screens: restorable("home", "settings"),
  };
  const snapshot = expectValue(snapshotScreenStack(source, sourceOptions));

  const target = new ScreenStack(definitions("home", "settings"));
  const wrongVersion = dryRunScreenStackRestore(target, snapshot, {
    ...sourceOptions,
    registryVersion: "registry@2",
  });
  assertEquals(codes(wrongVersion), ["registry-version-mismatch", "registry-fingerprint-mismatch"]);
  assertEquals(target.stackIds(), []);

  const drifted = new ScreenStack(definitions("home", "settings", "new-screen"));
  const drift = restoreScreenStackSnapshot(drifted, snapshot, {
    ...sourceOptions,
    screens: restorable("home", "settings", "new-screen"),
  });
  assertEquals(codes(drift), ["registry-fingerprint-mismatch"]);
  assertEquals(drifted.stackIds(), []);

  const denySettingsOptions: ScreenPersistenceOptions = {
    mode: "main",
    registryVersion: "registry@1",
    screens: { home: { restorable: true }, settings: { restorable: false } },
  };
  const empty = expectValue(snapshotScreenStack(target, denySettingsOptions));
  const injected = structuredClone(empty) as unknown as { screens: string[] };
  injected.screens = ["settings"];
  const denied = restoreScreenStackSnapshot(target, injected, denySettingsOptions);
  assertEquals(codes(denied), ["non-restorable-screen"]);
  assertEquals(target.stackIds(), []);
});

Deno.test("explicit migrations receive clone-safe input and current registry context", () => {
  const stack = new ScreenStack(definitions("home", "settings"));
  const legacy = {
    version: 0,
    modeName: "  legacy/模式  ",
    routes: ["home"],
  };
  let inputWasCloned = false;
  const options: ScreenPersistenceOptions = {
    mode: legacy.modeName,
    registryVersion: "registry@7",
    screens: restorable("home", "settings"),
    migrations: [{
      fromVersion: 0,
      toVersion: SCREEN_STACK_SNAPSHOT_VERSION,
      migrate(value, context) {
        inputWasCloned = value !== legacy;
        const candidate = value as { modeName: string; routes: string[] };
        candidate.routes.push("settings");
        return {
          schema: SCREEN_STACK_SNAPSHOT_SCHEMA,
          version: SCREEN_STACK_SNAPSHOT_VERSION,
          mode: candidate.modeName,
          registry: context.registry,
          screens: candidate.routes,
        };
      },
    }],
  };

  const dryRun = expectValue(dryRunScreenStackRestore(stack, legacy, options));
  assertEquals(inputWasCloned, true);
  assertEquals(legacy.routes, ["home"]);
  assertEquals(dryRun.snapshot.mode, legacy.modeName);
  assertEquals(dryRun.targetScreenIds, ["home", "settings"]);
  assertEquals(Object.isFrozen(dryRun.snapshot), true);

  const restored = expectValue(restoreScreenStackSnapshot(stack, legacy, options));
  assertEquals(restored.inspection.activeScreenId, "settings");
  assertEquals(stack.stackIds(), ["home", "settings"]);

  const missing = dryRunScreenStackRestore(new ScreenStack(definitions("home", "settings")), legacy, {
    ...options,
    migrations: [],
  });
  assertEquals(codes(missing), ["missing-migration"]);

  const failed = dryRunScreenStackRestore(new ScreenStack(definitions("home", "settings")), legacy, {
    ...options,
    migrations: [{
      fromVersion: 0,
      toVersion: 1,
      migrate() {
        throw new Error("legacy data is corrupt");
      },
    }],
  });
  assertEquals(codes(failed), ["migration-failed"]);
  assertEquals(failed.diagnostics[0]!.operation, "migration");
});

Deno.test("live modals are neither snapshotted nor settled by failed restore preflight", async () => {
  const options: ScreenPersistenceOptions = {
    mode: "main",
    registryVersion: "registry@1",
    screens: restorable("home", "dialog"),
  };
  const savedStack = new ScreenStack(definitions("home", "dialog"));
  savedStack.push("home");
  const saved = expectValue(snapshotScreenStack(savedStack, options));

  const live = new ScreenStack(definitions("home", "dialog"));
  live.push("home");
  let callbackCount = 0;
  let promiseSettled = false;
  const modalResult = live.pushModal<string>("dialog", () => callbackCount += 1);
  void modalResult.then(() => promiseSettled = true);

  const modalSnapshot = snapshotScreenStack(live, options);
  assertEquals(codes(modalSnapshot), ["modal-state-not-persistable"]);
  const restore = restoreScreenStackSnapshot(live, saved, options);
  await Promise.resolve();
  assertEquals(codes(restore), ["live-modal-state"]);
  assertEquals(live.stackIds(), ["home", "dialog"]);
  assertEquals(callbackCount, 0);
  assertEquals(promiseSettled, false);

  live.dismiss("dialog", "explicit-result");
  assertEquals(await modalResult, "explicit-result");
  assertEquals(callbackCount, 1);
});

Deno.test("disposed stack state is rejected rather than encoded or revived", () => {
  const options: ScreenPersistenceOptions = {
    mode: "main",
    registryVersion: "registry@1",
    screens: restorable("home"),
  };
  const source = new ScreenStack(definitions("home"));
  source.push("home");
  const saved = expectValue(snapshotScreenStack(source, options));
  source.dispose();
  const disposedSnapshot = snapshotScreenStack(source, options);
  assertEquals(codes(disposedSnapshot), ["disposed-stack"]);

  const target = new ScreenStack(definitions("home"));
  target.dispose();
  const restore = restoreScreenStackSnapshot(target, saved, options);
  assertEquals(codes(restore).includes("disposed-stack"), true);
  assertEquals(target.inspect().disposed, true);
  assertEquals(target.stackIds(), []);

  const encodedDisposed = structuredClone(saved) as unknown as Record<string, unknown>;
  encodedDisposed.disposed = false;
  const live = new ScreenStack(definitions("home"));
  const encodedResult = dryRunScreenStackRestore(live, encodedDisposed, options);
  assertEquals(codes(encodedResult), ["unknown-field"]);
  assertEquals(live.stackIds(), []);
});
