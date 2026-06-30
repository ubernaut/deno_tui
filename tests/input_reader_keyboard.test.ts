import { assertEquals } from "./deps.ts";
import { decodeKey } from "../src/input_reader/decoders/keyboard.ts";
import { decodeBuffer } from "../src/input_reader/mod.ts";

const encoder = new TextEncoder();

function decode(code: string) {
  return decodeKey(encoder.encode(code), code);
}

function snapshot(code: string) {
  const events: Array<{ key: string; meta: boolean; release: boolean | undefined }> = [];
  for (const event of decodeBuffer(encoder.encode(code))) {
    events.push({
      key: event.key,
      meta: "meta" in event ? event.meta : false,
      release: "release" in event ? event.release : undefined,
    });
  }
  return events;
}

function fullSnapshot(code: string) {
  return [...decodeBuffer(encoder.encode(code))].map((event) => ({ ...event }));
}

Deno.test("decodeKey maps xterm function keys", () => {
  assertEquals(decode("\x1bOP").key, "f1");
  assertEquals(decode("\x1bOQ").key, "f2");
  assertEquals(decode("\x1bOR").key, "f3");
  assertEquals(decode("\x1bOS").key, "f4");
  assertEquals(decode("\x1b[15~").key, "f5");
});

Deno.test("decodeKey maps alternate function key sequences", () => {
  assertEquals(decode("\x1b[11~").key, "f1");
  assertEquals(decode("\x1b[12~").key, "f2");
  assertEquals(decode("\x1b[[C").key, "f3");
  assertEquals(decode("\x1b[[D").key, "f4");
});

Deno.test("decodeKey keeps modifier flags on function keys", () => {
  const shifted = decode("\x1b[1;2Q");
  assertEquals(shifted.key, "f2");
  assertEquals(shifted.shift, true);

  const controlled = decode("\x1b[1;5P");
  assertEquals(controlled.key, "f1");
  assertEquals(controlled.ctrl, true);
});

Deno.test("decodeKey maps application cursor sequences", () => {
  assertEquals(decode("\x1bOA").key, "up");
  assertEquals(decode("\x1bOB").key, "down");
  assertEquals(decode("\x1bOC").key, "right");
  assertEquals(decode("\x1bOD").key, "left");
});

Deno.test("decodeBuffer splits repeated plain keys from a single read", () => {
  assertEquals(snapshot("jj\r").map((event) => event.key), ["j", "j", "return"]);
});

Deno.test("decodeBuffer splits mixed cursor and plain input from a single read", () => {
  assertEquals(snapshot("\x1b[Bj").map((event) => event.key), ["down", "j"]);
});

Deno.test("decodeBuffer preserves meta-modified characters", () => {
  const [event] = snapshot("\x1ba");
  assertEquals(event.key, "a");
  assertEquals(event.meta, true);
});

Deno.test("decodeBuffer splits batched mouse press and release events", () => {
  const events = snapshot("\x1b[<0;7;5M\x1b[<0;7;5m");
  assertEquals(events.map((event) => event.key), ["mouse", "mouse"]);
  assertEquals(events[0]?.release, false);
  assertEquals(events[1]?.release, true);
});

Deno.test("decodeBuffer emits bracketed paste as one payload event", () => {
  const events = fullSnapshot("\x1b[200~j\x1b[B\nhello\x1b[201~x");

  assertEquals(events.map((event) => event.key), ["paste", "x"]);
  assertEquals(events[0], {
    key: "paste",
    text: "j\x1b[B\nhello",
    buffer: encoder.encode("\x1b[200~j\x1b[B\nhello\x1b[201~"),
  });
});

Deno.test("decodeBuffer waits for complete bracketed paste payloads", () => {
  assertEquals(fullSnapshot("\x1b[200~partial paste").length, 0);
});

Deno.test("decodeBuffer emits terminal focus events", () => {
  const events = fullSnapshot("\x1b[I\x1b[O");

  assertEquals(events, [
    { key: "focus", focused: true, buffer: encoder.encode("\x1b[I") },
    { key: "focus", focused: false, buffer: encoder.encode("\x1b[O") },
  ]);
});
