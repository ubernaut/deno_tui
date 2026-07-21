import { assertEquals } from "./deps.ts";
import { EventEmitter } from "../src/event_emitter.ts";
import { decodeBuffer, emitInputEvents, type InputEventRecord } from "../src/input_reader/mod.ts";
import type { InputEvent, KeyPressEvent } from "../src/input_reader/types.ts";
import type { Stdin } from "../src/types.ts";

const encoder = new TextEncoder();

function decode(code: string): KeyPressEvent {
  const event = fullSnapshot(code)[0];
  if (!event || event.key === "mouse" || event.key === "paste" || event.key === "focus") {
    throw new Error(`Expected key press event for ${JSON.stringify(code)}`);
  }
  return event;
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

function fullSnapshot(code: string): InputEvent[] {
  const events: InputEvent[] = [];
  for (const event of decodeBuffer(encoder.encode(code))) {
    events.push({ ...event });
  }
  return events;
}

Deno.test("emitInputEvents drains input until EOF and restores event boundaries", async () => {
  const reads = [encoder.encode("ab"), encoder.encode("\x1b[A"), null];
  const rawModes: boolean[] = [];
  const stdin = {
    async read(buffer: Uint8Array) {
      const next = reads.shift();
      if (next == null) return null;
      buffer.set(next);
      return next.length;
    },
    setRaw(value: boolean) {
      rawModes.push(value);
    },
  } as unknown as Stdin;
  const emitter = new EventEmitter<InputEventRecord>();
  const keys: string[] = [];
  emitter.on("keyPress", (event) => {
    keys.push(event.key);
  });

  await emitInputEvents(stdin, emitter, 0);

  assertEquals(keys, ["a", "b", "up"]);
  assertEquals(rawModes, [true]);
});

Deno.test("emitInputEvents does not throttle immediately available reads by default", async () => {
  const reads = [encoder.encode("a"), encoder.encode("b"), null];
  const timerObservedByRead: boolean[] = [];
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
  }, 0);
  const stdin = {
    async read(buffer: Uint8Array) {
      timerObservedByRead.push(timerFired);
      const next = reads.shift();
      if (next == null) return null;
      buffer.set(next);
      return next.length;
    },
    setRaw() {},
  } as unknown as Stdin;
  const emitter = new EventEmitter<InputEventRecord>();
  const keys: string[] = [];
  emitter.on("keyPress", (event) => {
    keys.push(event.key);
  });

  await emitInputEvents(stdin, emitter);
  clearTimeout(timer);

  assertEquals(keys, ["a", "b"]);
  assertEquals(timerObservedByRead, [false, false, false]);
});

Deno.test("emitInputEvents yields after a zero-byte adapter read", async () => {
  const reads: Array<Uint8Array | 0 | null> = [0, encoder.encode("a"), null];
  const timerObservedByRead: boolean[] = [];
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
  }, 0);
  const stdin = {
    async read(buffer: Uint8Array) {
      timerObservedByRead.push(timerFired);
      const next = reads.shift();
      if (next == null || next === 0) return next;
      buffer.set(next);
      return next.length;
    },
    setRaw() {},
  } as unknown as Stdin;
  const emitter = new EventEmitter<InputEventRecord>();
  const keys: string[] = [];
  emitter.on("keyPress", (event) => {
    keys.push(event.key);
  });

  await emitInputEvents(stdin, emitter);
  clearTimeout(timer);

  assertEquals(keys, ["a"]);
  assertEquals(timerObservedByRead, [false, true, true]);
});

Deno.test("decodeBuffer maps xterm function keys", () => {
  assertEquals(decode("\x1bOP").key, "f1");
  assertEquals(decode("\x1bOQ").key, "f2");
  assertEquals(decode("\x1bOR").key, "f3");
  assertEquals(decode("\x1bOS").key, "f4");
  assertEquals(decode("\x1b[15~").key, "f5");
});

Deno.test("decodeBuffer maps alternate function key sequences", () => {
  assertEquals(decode("\x1b[11~").key, "f1");
  assertEquals(decode("\x1b[12~").key, "f2");
  assertEquals(decode("\x1b[[C").key, "f3");
  assertEquals(decode("\x1b[[D").key, "f4");
});

Deno.test("decodeBuffer keeps modifier flags on function keys", () => {
  const shifted = decode("\x1b[1;2Q");
  assertEquals(shifted.key, "f2");
  assertEquals(shifted.shift, true);

  const controlled = decode("\x1b[1;5P");
  assertEquals(controlled.key, "f1");
  assertEquals(controlled.ctrl, true);

  const alternateControlled = decode("\x1bO1;5P");
  assertEquals(alternateControlled.key, "f1");
  assertEquals(alternateControlled.ctrl, true);
});

Deno.test("decodeBuffer maps application cursor sequences", () => {
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

Deno.test("decodeBuffer preserves generated mixed input event boundaries", () => {
  const tokens = [
    { code: "a", key: "a" },
    { code: "Z", key: "Z" },
    { code: "\r", key: "return" },
    { code: "\t", key: "tab" },
    { code: "\x1b[A", key: "up" },
    { code: "\x1b[B", key: "down" },
    { code: "\x1b[[C", key: "f3" },
    { code: "\x1b[<0;7;5M", key: "mouse" },
    { code: "\x1b[<0;7;5m", key: "mouse" },
    { code: "\x1b[I", key: "focus" },
    { code: "\x1b[O", key: "focus" },
    { code: "\x1b[200~a\x1b[B\npaste\x1b[201~", key: "paste" },
  ];
  const random = seededRandom(0x1a90d);

  for (let run = 0; run < 100; run += 1) {
    const selected: typeof tokens = [];
    const count = 1 + Math.floor(random() * 24);
    for (let index = 0; index < count; index += 1) {
      selected.push(tokens[Math.floor(random() * tokens.length)]);
    }

    const code = selected.map((token) => token.code).join("");
    assertEquals(
      fullSnapshot(code).map((event) => event.key),
      selected.map((token) => token.key),
    );
  }
});

Deno.test("decodeBuffer ignores generated incomplete trailing escape sequences", () => {
  const complete = [
    { code: "x", key: "x" },
    { code: "\x1b[C", key: "right" },
    { code: "\x1b[<64;2;3M", key: "mouse" },
    { code: "\x1b[200~payload\x1b[201~", key: "paste" },
  ];
  const incomplete = ["\x1b", "\x1b[", "\x1b[[", "\x1b[<0;7;5", "\x1b[200~partial"];
  const random = seededRandom(0xdec0de);

  for (let run = 0; run < 100; run += 1) {
    const selected: typeof complete = [];
    const count = 1 + Math.floor(random() * 16);
    for (let index = 0; index < count; index += 1) {
      selected.push(complete[Math.floor(random() * complete.length)]);
    }
    const tail = incomplete[Math.floor(random() * incomplete.length)];

    assertEquals(
      fullSnapshot(selected.map((token) => token.code).join("") + tail).map((event) => event.key),
      selected.map((token) => token.key),
    );
  }
});

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function decodeMouseEvents(code: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const event of decodeBuffer(encoder.encode(code))) {
    if (event.key === "mouse") events.push({ ...event });
  }
  return events;
}

Deno.test("decodeBuffer maps SGR wheel codes to signed vertical scroll", () => {
  const up = decodeMouseEvents("\x1b[<64;5;6M");
  assertEquals(up.length, 1);
  assertEquals(up[0]!.scroll, -1);
  const down = decodeMouseEvents("\x1b[<65;5;6M");
  assertEquals(down[0]!.scroll, 1);
  const ctrlUp = decodeMouseEvents("\x1b[<80;5;6M");
  assertEquals(ctrlUp[0]!.scroll, -1);
  assertEquals(ctrlUp[0]!.ctrl, true);
});

Deno.test("decodeBuffer never reports SGR horizontal wheel motion as vertical scroll", () => {
  assertEquals(decodeMouseEvents("\x1b[<66;5;6M"), []);
  assertEquals(decodeMouseEvents("\x1b[<67;5;6M"), []);
});

Deno.test("decodeBuffer maps legacy X10 wheel bytes to signed vertical scroll", () => {
  const up = decodeMouseEvents("\x1b[M\x60\x25\x26");
  assertEquals(up.length, 1);
  assertEquals(up[0]!.scroll, -1);
  const down = decodeMouseEvents("\x1b[M\x61\x25\x26");
  assertEquals(down[0]!.scroll, 1);
  assertEquals(decodeMouseEvents("\x1b[M\x62\x25\x26"), []);
});
