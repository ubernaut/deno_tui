// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  createTerminalOscRouter,
  createTerminalOscService,
  createTerminalThemeProbe,
  parseTerminalOscColorResponse,
  parseTerminalOscMessage,
  sanitizeTerminalOscText,
  terminalClipboardSequence,
  terminalColorQuerySequence,
  terminalDynamicColorSequence,
  terminalNotificationSequence,
  terminalTitleSequence,
} from "../src/runtime/terminal_services.ts";

Deno.test("terminal OSC builders sanitize injected controls and support ST or BEL", () => {
  assertEquals(terminalTitleSequence("safe\x1b]52;c;evil\x07\nnext"), "\x1b]2;safe]52;c;evil next\x1b\\");
  assertEquals(terminalTitleSequence("title", { includeIconName: true, terminator: "bel" }), "\x1b]0;title\x07");
  assertEquals(terminalNotificationSequence("done", { title: "Build" }), "\x1b]9;Build: done\x1b\\");
  assertEquals(sanitizeTerminalOscText("a\tb\rc\nd\x9de"), "a b c de");
});

Deno.test("terminal dynamic color builders normalize colors and queries", () => {
  assertEquals(terminalDynamicColorSequence("foreground", "#1af"), "\x1b]10;rgb:11/aa/ff\x1b\\");
  assertEquals(terminalDynamicColorSequence("background", "#102030"), "\x1b]11;rgb:10/20/30\x1b\\");
  assertEquals(terminalColorQuerySequence("foreground"), "\x1b]10;?\x1b\\");
  assertEquals(terminalColorQuerySequence("background"), "\x1b]11;?\x1b\\");
  assertEquals(terminalColorQuerySequence(300), "\x1b]4;255;?\x1b\\");
});

Deno.test("terminal OSC 52 clipboard encodes UTF-8 and enforces byte limits", () => {
  assertEquals(terminalClipboardSequence("hello"), "\x1b]52;c;aGVsbG8=\x1b\\");
  assertEquals(terminalClipboardSequence("✓", { selection: "primary" }), "\x1b]52;p;4pyT\x1b\\");

  let message = "";
  try {
    terminalClipboardSequence("✓", { maxBytes: 2 });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertStringIncludes(message, "3 bytes; maximum is 2");
});

Deno.test("terminal OSC messages and color responses parse BEL and ST replies", () => {
  assertEquals(parseTerminalOscMessage("\x1b]11;rgb:1111/8080/ffff\x07"), {
    command: "11",
    data: "rgb:1111/8080/ffff",
    params: "11;rgb:1111/8080/ffff",
    raw: "\x1b]11;rgb:1111/8080/ffff\x07",
  });
  assertEquals(parseTerminalOscColorResponse("\x1b]11;rgb:1111/8080/ffff\x07"), {
    command: "11",
    target: "background",
    color: "#1180ff",
    rawColor: "rgb:1111/8080/ffff",
  });
  assertEquals(parseTerminalOscColorResponse("\x1b]4;12;rgb:aa/bb/cc\x1b\\"), {
    command: "4",
    target: "palette",
    paletteIndex: 12,
    color: "#aabbcc",
    rawColor: "rgb:aa/bb/cc",
  });
  assertEquals(parseTerminalOscColorResponse("\x1b]4;999;rgb:aa/bb/cc\x07"), undefined);
});

Deno.test("terminal OSC service fails closed and reports write or validation errors", () => {
  const writes: string[] = [];
  const disabled = createTerminalOscService({ write: (value) => writes.push(value) });
  assertEquals(disabled.setTitle("hidden"), {
    capability: "title",
    sent: false,
    reason: "title is disabled by terminal OSC policy",
  });
  assertEquals(writes, []);

  const enabled = createTerminalOscService({
    write: (value) => writes.push(value),
    policy: { title: true, dynamicColors: true, clipboard: true, notifications: true, queries: true },
    maxClipboardBytes: 4,
  });
  assertEquals(enabled.setTitle("visible").sent, true);
  assertEquals(enabled.setColor("background", "not-a-color"), {
    capability: "dynamicColors",
    sent: false,
    reason: "unsupported terminal color: not-a-color",
  });
  assertEquals(enabled.copy("12345"), {
    capability: "clipboard",
    sent: false,
    reason: "clipboard payload is 5 bytes; maximum is 4",
  });
  assertEquals(enabled.notify("done", "Build").sent, true);
  assertEquals(enabled.queryColor(7).sent, true);
  assertEquals(writes.length, 3);
});

Deno.test("terminal OSC router handles chunked replies, wildcards, and handler failures", () => {
  const exact: string[] = [];
  const wildcard: string[] = [];
  const errors: string[] = [];
  const router = createTerminalOscRouter({
    onHandlerError: (error, message) => errors.push(`${message.command}:${error.message}`),
  });
  const disposeExact = router.subscribe(11, (message) => exact.push(message.data));
  router.subscribe("*", (message) => wildcard.push(message.command));
  router.subscribe(11, () => {
    throw new Error("subscriber exploded");
  });

  assertEquals(router.push("text\x1b]11;rgb:00/11"), 0);
  assertEquals(router.inspect().pendingBytes > 0, true);
  assertEquals(router.push("/22\x07tail\x1b]10;rgb:ff/ee/dd\x1b\\"), 2);
  assertEquals(exact, ["rgb:00/11/22"]);
  assertEquals(wildcard, ["11", "10"]);
  assertEquals(errors, ["11:subscriber exploded"]);
  assertEquals(router.inspect(), {
    subscriptions: 3,
    commands: ["*", "11"],
    pendingBytes: 0,
    dispatched: 2,
    handlerErrors: 1,
    droppedBytes: 0,
  });

  disposeExact();
  assertEquals(router.inspect().subscriptions, 2);
  router.clear();
  assertEquals(router.inspect().subscriptions, 0);
});

Deno.test("terminal OSC router bounds incomplete untrusted sequences", () => {
  const router = createTerminalOscRouter({ maxPendingBytes: 16 });
  router.push(`\x1b]52;${"x".repeat(40)}`);
  assertEquals(router.inspect().pendingBytes, 16);
  assertEquals(router.inspect().droppedBytes, 29);
  router.reset();
  assertEquals(router.inspect().pendingBytes, 0);
});

Deno.test("terminal theme probe queries explicit targets and classifies routed replies", () => {
  const writes: string[] = [];
  const router = createTerminalOscRouter();
  const service = createTerminalOscService({
    write: (sequence) => writes.push(sequence),
    policy: { queries: true },
  });
  const probe = createTerminalThemeProbe({ service, router, paletteIndices: [9, 1, 9, 400] });
  const revisions: number[] = [];
  probe.subscribe(() => revisions.push(probe.inspect().revision));

  assertEquals(probe.start().every((result) => result.sent), true);
  assertEquals(writes.length, 5);
  assertEquals(probe.inspect().pending, ["foreground", "background", "palette:1", "palette:9", "palette:255"]);

  router.push("\x1b]10;rgb:eeee/eeee/eeee\x1b\\");
  router.push("\x1b]11;rgb:0808/1010/1818\x07");
  router.push("\x1b]4;9;rgb:ffff/0000/8080\x1b\\");
  router.push("\x1b]4;1;rgb:1111/2222/3333\x1b\\");
  router.push("\x1b]4;255;rgb:aaaa/bbbb/cccc\x1b\\");

  assertEquals(probe.inspect(), {
    active: false,
    disposed: false,
    complete: true,
    revision: 6,
    appearance: "dark",
    foreground: "#eeeeee",
    background: "#081018",
    palette: { "1": "#112233", "9": "#ff0080", "255": "#aabbcc" },
    requested: ["foreground", "background", "palette:1", "palette:9", "palette:255"],
    pending: [],
    failures: [],
  });
  assertEquals(revisions, [1, 2, 3, 4, 5, 6]);
  probe.dispose();
  assertEquals(router.inspect().subscriptions, 0);
});

Deno.test("terminal theme probe fails closed and retains deadline diagnostics", () => {
  const router = createTerminalOscRouter();
  const disabled = createTerminalOscService({ write: () => {} });
  const blocked = createTerminalThemeProbe({ service: disabled, router, paletteIndices: [0] });
  assertEquals(blocked.start().map((result) => result.sent), [false, false, false]);
  assertEquals(blocked.inspect().complete, true);
  assertEquals(blocked.inspect().failures.length, 3);
  assertEquals(disabled.inspect().policy.queries, false);
  blocked.dispose();

  const pending = createTerminalThemeProbe({
    service: createTerminalOscService({ write: () => {}, policy: { queries: true } }),
    router,
  });
  pending.start();
  router.push("\x1b]11;rgb:ffff/ffff/ffff\x1b\\");
  const finished = pending.finish("deadline expired");
  assertEquals(finished.complete, false);
  assertEquals(finished.appearance, "light");
  assertEquals(finished.pending, ["foreground"]);
  assertEquals(finished.failures, ["foreground: deadline expired"]);
  pending.dispose();
});
