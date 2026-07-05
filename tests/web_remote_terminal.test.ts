import { assertEquals, assertNotEquals } from "./deps.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import type { ProcessSessionCommand, ProcessSessionInspection, ProcessSessionStatus } from "../src/runtime/mod.ts";
import type { TerminalSessionHandle } from "../src/runtime/terminal_backend.ts";
import {
  defaultWebTerminalWorkspaceSnapshot,
  normalizeWebTerminalWorkspaceSnapshot,
} from "../examples/web/api_workbench_terminal_workspace.ts";
import {
  createRemoteTerminalBridge,
  createRemoteTerminalClient,
  decodeRemoteTerminalClientMessage,
  decodeRemoteTerminalServerMessage,
  encodeRemoteTerminalInput,
  encodeRemoteTerminalMessage,
  type RemoteTerminalTransport,
} from "../mod.remote.ts";

Deno.test("web api workbench terminal workspace default exposes browser demo sessions", () => {
  const snapshot = defaultWebTerminalWorkspaceSnapshot();

  assertEquals(snapshot.activeId, "pages-shell");
  assertEquals(snapshot.sessions.map((session) => session.id), ["pages-shell", "remote-attach", "ci-task"]);
  assertEquals(snapshot.sessions.map((session) => session.template.kind), ["command", "attach", "deno-task"]);
  assertEquals(snapshot.sessions[0]?.status, "running");
  assertEquals(snapshot.sessions[1]?.reconnectable, true);
  assertEquals(snapshot.sessions[2]?.restartPolicy, "on-failure");
});

Deno.test("web api workbench terminal workspace normalizer rejects non-workspace values", () => {
  assertEquals(normalizeWebTerminalWorkspaceSnapshot(undefined), undefined);
  assertEquals(normalizeWebTerminalWorkspaceSnapshot({}), undefined);
  assertEquals(normalizeWebTerminalWorkspaceSnapshot({ sessions: [], layout: {} }), undefined);
});

Deno.test("web api workbench terminal workspace normalizer clones and repairs active session", () => {
  const source = defaultWebTerminalWorkspaceSnapshot();
  const normalized = normalizeWebTerminalWorkspaceSnapshot({ ...source, activeId: "missing-session" });

  assertEquals(normalized?.version, 1);
  assertEquals(normalized?.activeId, "pages-shell");
  assertEquals(normalized?.sessions.map((session) => session.id), ["pages-shell", "remote-attach", "ci-task"]);
  assertNotEquals(normalized?.sessions, source.sessions);
  assertNotEquals(normalized?.sessions[0], source.sessions[0]);
});

Deno.test("remote terminal protocol preserves input event buffers", () => {
  const encoded = encodeRemoteTerminalMessage({
    type: "input",
    input: {
      kind: "keyPress",
      event: {
        key: "a",
        meta: false,
        ctrl: true,
        shift: false,
        buffer: new Uint8Array([1, 2, 3]),
      },
    },
  });

  assertEquals(decodeRemoteTerminalClientMessage(encoded), {
    type: "input",
    input: {
      kind: "keyPress",
      event: {
        key: "a",
        meta: false,
        ctrl: true,
        shift: false,
        buffer: new Uint8Array([1, 2, 3]),
      },
    },
  });
});

Deno.test("remote terminal protocol preserves paste and focus events", () => {
  const paste = encodeRemoteTerminalMessage({
    type: "input",
    input: {
      kind: "paste",
      event: {
        key: "paste",
        text: "alpha\nbeta",
        buffer: new Uint8Array([97, 10, 98]),
      },
    },
  });
  const focus = encodeRemoteTerminalMessage({
    type: "input",
    input: {
      kind: "terminalFocus",
      event: {
        key: "focus",
        focused: true,
        buffer: new Uint8Array(),
      },
    },
  });

  assertEquals(decodeRemoteTerminalClientMessage(paste), {
    type: "input",
    input: {
      kind: "paste",
      event: {
        key: "paste",
        text: "alpha\nbeta",
        buffer: new Uint8Array([97, 10, 98]),
      },
    },
  });
  assertEquals(decodeRemoteTerminalClientMessage(focus), {
    type: "input",
    input: {
      kind: "terminalFocus",
      event: {
        key: "focus",
        focused: true,
        buffer: new Uint8Array(),
      },
    },
  });
});

Deno.test("remote terminal client sends input and emits terminal data", () => {
  const transport = new FakeRemoteTerminalTransport();
  const client = createRemoteTerminalClient(transport);
  const data: Array<string | Uint8Array> = [];
  client.on("data", (value) => {
    data.push(value);
  });

  client.sendKeyPress({
    key: "return",
    meta: false,
    ctrl: false,
    shift: false,
    buffer: new Uint8Array([13]),
  });
  client.resize({ columns: 120, rows: 36 });
  transport.receive(JSON.stringify({ type: "data", data: "hello" }));

  assertEquals(decodeRemoteTerminalClientMessage(transport.sent[0]!), {
    type: "input",
    input: {
      kind: "keyPress",
      event: {
        key: "return",
        meta: false,
        ctrl: false,
        shift: false,
        buffer: new Uint8Array([13]),
      },
    },
  });
  assertEquals(decodeRemoteTerminalClientMessage(transport.sent[1]!), {
    type: "resize",
    size: { columns: 120, rows: 36 },
  });
  assertEquals(data, ["hello"]);
  assertEquals(client.inspectClient(), {
    open: true,
    dataMessages: 1,
    inputMessages: 1,
    resizeMessages: 1,
  });
});

Deno.test("remote terminal input encoder preserves key paste and mouse buffers", () => {
  assertEquals(
    encodeRemoteTerminalInput({
      kind: "keyPress",
      event: { key: "up", meta: false, ctrl: false, shift: false, buffer: new Uint8Array() },
    }),
    new TextEncoder().encode("\x1b[A"),
  );
  assertEquals(
    encodeRemoteTerminalInput({
      kind: "paste",
      event: { key: "paste", text: "paste", buffer: new Uint8Array() },
    }),
    new TextEncoder().encode("paste"),
  );
  assertEquals(
    encodeRemoteTerminalInput({
      kind: "mousePress",
      event: {
        key: "mouse",
        buffer: new Uint8Array([1, 2, 3]),
        x: 1,
        y: 2,
        movementX: 0,
        movementY: 0,
        meta: false,
        ctrl: false,
        shift: false,
        drag: false,
        release: false,
        button: 0,
      },
    }),
    new Uint8Array([1, 2, 3]),
  );
});

Deno.test("remote terminal bridge routes client messages to backend handles", async () => {
  const transport = new FakeRemoteTerminalTransport();
  const session = new FakeTerminalSessionHandle();
  const bridge = createRemoteTerminalBridge(transport, session);

  transport.receive(encodeRemoteTerminalMessage({
    type: "input",
    input: {
      kind: "keyPress",
      event: { key: "a", meta: false, ctrl: false, shift: false, buffer: new Uint8Array() },
    },
  }));
  await tick();
  assertEquals(session.writes, ["a"]);

  transport.receive(encodeRemoteTerminalMessage({ type: "resize", size: { columns: 100, rows: 30 } }));
  await tick();
  assertEquals(session.columns, 100);
  assertEquals(session.rows, 30);
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!), {
    type: "resize",
    size: { columns: 100, rows: 30 },
  });

  transport.receive(encodeRemoteTerminalMessage({ type: "ping", id: "p1" }));
  await tick();
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!), { type: "pong", id: "p1" });

  session.output.appendText("stdout", "ready", 1);
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!), { type: "data", data: "[out] ready\n" });
  bridge.sendData(new Uint8Array([7, 8]));
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!), {
    type: "binary",
    data: new Uint8Array([7, 8]),
  });

  transport.receive("{");
  await tick();
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!).type, "error");
  assertEquals(bridge.inspectBridge(), {
    open: true,
    dataMessages: 2,
    inputMessages: 1,
    resizeMessages: 1,
    errorMessages: 1,
  });

  const sentBeforeClose = transport.sent.length;
  bridge.close("done");
  assertEquals(transport.sent.length, sentBeforeClose + 1);
  assertEquals(decodeRemoteTerminalServerMessage(transport.sent.at(-1)!), { type: "close", reason: "done" });
});

class FakeRemoteTerminalTransport implements RemoteTerminalTransport {
  readonly sent: Array<string | Uint8Array> = [];
  #messageListeners: Array<(message: string | Uint8Array) => void> = [];
  #closeListeners: Array<(reason?: string) => void> = [];

  send(message: string | Uint8Array): void {
    this.sent.push(message);
  }

  close(_code?: number, reason?: string): void {
    for (const listener of this.#closeListeners) listener(reason);
  }

  onMessage(listener: (message: string | Uint8Array) => void): () => void {
    this.#messageListeners.push(listener);
    return () => {
      const index = this.#messageListeners.indexOf(listener);
      if (index >= 0) this.#messageListeners.splice(index, 1);
    };
  }

  onClose(listener: (reason?: string) => void): () => void {
    this.#closeListeners.push(listener);
    return () => {
      const index = this.#closeListeners.indexOf(listener);
      if (index >= 0) this.#closeListeners.splice(index, 1);
    };
  }

  receive(message: string | Uint8Array): void {
    for (const listener of this.#messageListeners) listener(message);
  }
}

class FakeTerminalSessionHandle implements TerminalSessionHandle {
  readonly id = "terminal";
  readonly backendId = "fake";
  readonly command: ProcessSessionCommand = { command: "demo" };
  readonly output = new TerminalOutputController();
  readonly closed = Promise.resolve({ status: "exited" } as ProcessSessionInspection);
  readonly writes: string[] = [];
  columns = 80;
  rows = 24;

  write(data: string | Uint8Array): Promise<boolean> {
    this.writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
    return Promise.resolve(true);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.columns = columns;
    this.rows = rows;
    return Promise.resolve(true);
  }

  kill(): Promise<boolean> {
    return Promise.resolve(true);
  }

  inspect() {
    const status: ProcessSessionStatus = "running";
    return {
      id: this.id,
      backendId: this.backendId,
      commandLine: "demo",
      status,
      running: true,
      columns: this.columns,
      rows: this.rows,
      resizeSupported: true,
    };
  }

  dispose(): Promise<void> {
    this.output.dispose();
    return Promise.resolve();
  }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
