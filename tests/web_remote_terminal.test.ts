import { assertEquals } from "./deps.ts";
import {
  createRemoteTerminalClient,
  decodeRemoteTerminalClientMessage,
  encodeRemoteTerminalMessage,
  type RemoteTerminalTransport,
} from "../mod.remote.ts";

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
