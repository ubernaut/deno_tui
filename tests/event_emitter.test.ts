// Copyright 2023 Im-Beast. MIT license.

import { type EmitterEvent, EventEmitter } from "../src/event_emitter.ts";
import { assertEquals } from "./deps.ts";

type TestEvents = {
  test: EmitterEvent<[string]>;
  other: EmitterEvent<[]>;
};

Deno.test("EventEmitter emits persistent and once listeners", () => {
  const emitter = new EventEmitter<TestEvents>();
  const seen: string[] = [];

  emitter.on("test", (value) => {
    seen.push(`on:${value}`);
  });
  emitter.once("test", (value) => {
    seen.push(`once:${value}`);
  });

  emitter.emit("test", "a");
  emitter.emit("test", "b");

  assertEquals(seen, ["on:a", "once:a", "on:b"]);
  assertEquals(emitter.listenerCount("test"), 1);
});

Deno.test("EventEmitter disposers only remove matching listeners", () => {
  const emitter = new EventEmitter<TestEvents>();
  const first = () => undefined;
  const second = () => undefined;
  const disposeFirst = emitter.on("other", first);
  emitter.on("other", second);

  emitter.off("other", (() => undefined) as typeof first);
  assertEquals(emitter.listenerCount("other"), 2);

  disposeFirst();
  disposeFirst();
  assertEquals(emitter.listenerCount("other"), 1);
});

Deno.test("EventEmitter exposes event names counts and inspection", () => {
  const emitter = new EventEmitter<TestEvents>();
  emitter.on("test", () => undefined);
  emitter.on("test", () => undefined);
  emitter.on("other", () => undefined);

  assertEquals(emitter.listenerCount(), 3);
  assertEquals(emitter.eventNames(), ["test", "other"]);
  assertEquals(emitter.inspect(), {
    eventCount: 2,
    listenerCount: 3,
    events: [
      { type: "other", listenerCount: 1 },
      { type: "test", listenerCount: 2 },
    ],
  });

  emitter.off("test");
  assertEquals(emitter.inspect(), {
    eventCount: 1,
    listenerCount: 1,
    events: [{ type: "other", listenerCount: 1 }],
  });

  emitter.off();
  assertEquals(emitter.inspect(), { eventCount: 0, listenerCount: 0, events: [] });
});
