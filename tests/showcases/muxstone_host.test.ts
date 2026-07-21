import { assert, assertEquals, assertRejects } from "../deps.ts";
import { TerminalOutputController } from "../../src/components/terminal_output.ts";
import type {
  ProcessSessionCommand,
  ProcessSessionInspection,
  ProcessSessionStatus,
} from "../../src/runtime/process_session.ts";
import type {
  TerminalBackend,
  TerminalBackendSpawnOptions,
  TerminalSessionHandle,
  TerminalSessionHandleInspection,
} from "../../src/runtime/terminal_backend.ts";
import {
  decodeMuxstoneData,
  decodeMuxstoneServerMessage,
  encodeMuxstoneData,
  MUXSTONE_PROTOCOL_LIMITS,
  type MuxstoneServerMessage,
} from "../../examples/showcases/muxstone/protocol.ts";
import {
  createDefaultMuxstoneTerminalBackend,
  MUXSTONE_PTY_POLLING_INTERVAL_MS,
  type MuxstoneHostConnection,
  MuxstoneHostController,
  type MuxstoneHostPeer,
} from "../../examples/showcases/muxstone/host.ts";

const AUTH_TOKEN = "ab".repeat(32);
const textDecoder = new TextDecoder();

Deno.test("muxstone default PTY backend uses the responsive output polling cadence", async () => {
  const backend = new FakeTerminalBackend();
  let observedPollingInterval: number | undefined;
  const selected = await createDefaultMuxstoneTerminalBackend((options) => {
    observedPollingInterval = options.pollingIntervalMs;
    return Promise.resolve(backend);
  });

  assertEquals(selected, backend);
  assertEquals(MUXSTONE_PTY_POLLING_INTERVAL_MS, 8);
  assertEquals(observedPollingInterval, MUXSTONE_PTY_POLLING_INTERVAL_MS);
});

Deno.test("muxstone host publishes foreground application title changes", async () => {
  const backend = new FakeTerminalBackend();
  let now = 1_000;
  let nextId = 0;
  const host = new MuxstoneHostController({
    authToken: AUTH_TOKEN,
    backend,
    now: () => now,
    idFactory: () => `title-${++nextId}`,
  });
  const peer = new FakePeer();
  const connection = host.connect(peer);
  await authenticate(connection);
  await connection.receive(wire({
    version: 1,
    type: "spawn",
    requestId: 1,
    command: "/bin/bash",
    title: "terminal 1",
  }));
  await drain();

  const spawned = peer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  assertEquals(spawned.session.title, "bash");
  const handle = backend.handles[0]!;
  handle.title = "vim";
  now += 200;
  handle.emit("screen update");
  await drain();

  const states = peer.messages().filter((message) => message.type === "session-state");
  assertEquals(states.at(-1)?.type === "session-state" ? states.at(-1)!.session.title : undefined, "vim");
  await host.shutdown();
});

Deno.test("muxstone host disconnect retains backend session and stable id for reconnect", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const firstPeer = new FakePeer();
  const first = host.connect(firstPeer);
  await authenticate(first);
  await first.receive(wire({
    version: 1,
    type: "spawn",
    requestId: 1,
    command: "/bin/sh",
    args: ["-l"],
    columns: 90,
    rows: 28,
    title: "persistent shell",
  }));
  await drain();

  const spawned = firstPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  const sessionId = spawned.session.id;
  const handle = backend.handles[0]!;
  handle.emit("before disconnect");
  await drain();
  first.disconnect();

  assertEquals(handle.killCalls, 0);
  assertEquals(handle.disposeCalls, 0);
  assertEquals(host.inspect().sessions.map((session) => session.id), [sessionId]);
  assertEquals(host.inspect().sessions[0]?.attachedClients, 0);

  handle.emit("while detached");
  const secondPeer = new FakePeer();
  const second = host.connect(secondPeer);
  await authenticate(second);
  await second.receive(wire({ version: 1, type: "list", requestId: 1 }));
  await second.receive(wire({
    version: 1,
    type: "attach",
    requestId: 2,
    sessionId,
    afterSequence: 1,
  }));
  await drain();

  const sessions = secondPeer.messages().find((message) => message.type === "sessions");
  assert(sessions?.type === "sessions");
  assertEquals(sessions.sessions.map((session) => session.id), [sessionId]);
  const attached = secondPeer.messages().find((message) => message.type === "attached");
  assert(attached?.type === "attached");
  assertEquals(attached.truncated, false);
  const replay = secondPeer.messages().filter((message) => message.type === "output");
  assertEquals(replay.map((message) => message.sequence), [2]);
  assertEquals(textDecoder.decode(decodeMuxstoneData(replay[0]!.data)), "while detached");

  second.disconnect();
  await host.shutdown();
  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
});

Deno.test("muxstone attach reports replay truncation and preserves monotonic output order", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { replayEntries: 2, replayBytes: 1024 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "demo" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();

  const handle = backend.handles[0]!;
  handle.emit("one");
  handle.emit("two");
  handle.emit("three");

  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await drain();

  const attached = peer.messages().find((message) => message.type === "attached");
  assert(attached?.type === "attached");
  assertEquals(attached.truncated, true);
  assertEquals(attached.replayFromSequence, 2);
  assertEquals(attached.latestSequence, 3);
  const replay = peer.messages().filter((message) => message.type === "output");
  assertEquals(replay.map((message) => message.sequence), [2, 3]);
  assertEquals(
    replay.map((message) => textDecoder.decode(decodeMuxstoneData(message.data))),
    ["two", "three"],
  );

  await host.shutdown();
});

Deno.test("muxstone streams retained replay larger than the outbound message quota", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, {
    outboundMessages: 8,
    outboundBytes: 16 * 1024,
    replayEntries: 700,
    replayBytes: 1024 * 1024,
  });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "verbose" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();

  const replayCount = 600;
  for (let sequence = 1; sequence <= replayCount; sequence += 1) {
    backend.handles[0]!.emit(`frame-${sequence}`);
  }

  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await waitFor(() => peer.sent.length === replayCount + 2);
  await drain();

  assertEquals(peer.closes, []);
  assertEquals(
    peer.messages().filter((message) => message.type === "output").map((message) => message.sequence),
    Array.from({ length: replayCount }, (_, index) => index + 1),
  );
  assertEquals(client.inspect().queuedOutboundMessages, 0);
  assertEquals(client.inspect().queuedOutboundBytes, 0);
  await host.shutdown();
});

Deno.test("muxstone fairly replays multiple sessions and fences their live output", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, {
    outboundMessages: 32,
    outboundBytes: 16 * 1024,
    replayEntries: 8,
    replayBytes: 1024 * 1024,
  });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "first" }));
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 2, command: "second" }));
  await drain(30);
  const sessions = ownerPeer.messages().filter((message) => message.type === "spawned");
  assertEquals(sessions.length, 2);
  const firstId = sessions[0]!.session.id;
  const secondId = sessions[1]!.session.id;
  owner.disconnect();
  for (let sequence = 1; sequence <= 8; sequence += 1) {
    backend.handles[0]!.emit(`first-replay-${sequence}`);
    backend.handles[1]!.emit(`second-replay-${sequence}`);
  }

  const peer = new PausablePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.pause();
  const firstAttach = client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: firstId,
    afterSequence: 0,
  }));
  const secondAttach = client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 2,
    sessionId: secondId,
    afterSequence: 0,
  }));
  await Promise.all([firstAttach, secondAttach]);
  for (let sequence = 1; sequence <= 8; sequence += 1) {
    backend.handles[0]!.emit(`first-live-${sequence}`);
    backend.handles[1]!.emit(`second-live-${sequence}`);
  }

  assertEquals(client.inspect().queuedOutboundMessages, 18);
  assert(client.inspect().queuedOutboundBytes <= 16 * 1024);
  peer.resume();
  await waitFor(() => peer.messages().filter((message) => message.type === "output").length === 32);

  assertEquals(peer.closes, []);
  const delivered = peer.messages();
  const attached = delivered.filter((message) => message.type === "attached");
  assertEquals(attached.map((message) => message.session.id), [firstId, secondId]);
  for (const [sessionId, prefix] of [[firstId, "first"], [secondId, "second"]] as const) {
    const output = delivered.filter((message) => message.type === "output").filter((message) =>
      message.sessionId === sessionId
    );
    assertEquals(output.map((message) => message.sequence), Array.from({ length: 16 }, (_, index) => index + 1));
    assertEquals(
      output.map((message) => textDecoder.decode(decodeMuxstoneData(message.data))),
      [
        ...Array.from({ length: 8 }, (_, index) => `${prefix}-replay-${index + 1}`),
        ...Array.from({ length: 8 }, (_, index) => `${prefix}-live-${index + 1}`),
      ],
    );
  }
  const firstOutputSessions = delivered.filter((message) => message.type === "output").slice(0, 4).map((message) =>
    message.sessionId
  );
  assertEquals(firstOutputSessions, [firstId, secondId, firstId, secondId]);
  await host.shutdown();
});

Deno.test("muxstone snapshots three full replay rings before live output rotates them", async () => {
  const backend = new FakeTerminalBackend();
  const replayEntries = 2048;
  const host = createHost(backend, {
    outboundMessages: 16,
    outboundBytes: 1024 * 1024,
    replayEntries,
    replayBytes: 1024 * 1024,
  });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  for (let requestId = 1; requestId <= 3; requestId += 1) {
    await owner.receive(wire({ version: 1, type: "spawn", requestId, command: `full-ring-${requestId}` }));
  }
  await drain(30);
  const spawned = ownerPeer.messages().filter((message) => message.type === "spawned");
  assertEquals(spawned.length, 3);
  owner.disconnect();
  for (const handle of backend.handles) {
    for (let sequence = 1; sequence <= replayEntries; sequence += 1) handle.emit(`r${sequence}`);
  }

  const peer = new PausablePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.pause();
  const attaches = spawned.map((message, index) =>
    client.receive(wire({
      version: 1,
      type: "attach",
      requestId: index + 1,
      sessionId: message.session.id,
      afterSequence: 0,
    }))
  );
  await Promise.all(attaches);
  for (const handle of backend.handles) handle.emit("live-after-barrier");
  await client.receive(wire({ version: 1, type: "ping", requestId: 4 }));
  peer.resume();
  const expectedMessages = 1 + 3 + (3 * (replayEntries + 1)) + 1;
  await waitFor(() => peer.sent.length === expectedMessages, 100_000);
  await drain();

  assertEquals(peer.closes, []);
  const delivered = peer.messages();
  const firstOutput = delivered.findIndex((message) => message.type === "output");
  const pong = delivered.findIndex((message) => message.type === "pong");
  assert(pong >= 0 && pong < firstOutput);
  for (const session of spawned) {
    const output = delivered.filter((message) => message.type === "output").filter((message) =>
      message.sessionId === session.session.id
    );
    assertEquals(
      output.map((message) => message.sequence),
      Array.from({ length: replayEntries + 1 }, (_, index) => index + 1),
    );
    assertEquals(textDecoder.decode(decodeMuxstoneData(output.at(-1)!.data)), "live-after-barrier");
  }
  await host.shutdown();
});

Deno.test("muxstone closes a backpressured replay transport without killing its PTY", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 4, replayEntries: 16 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "persistent" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();
  backend.handles[0]!.emit("retained");

  const peer = new RejectingPeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.reject = true;
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await drain();

  assertEquals(peer.closes, [{ code: 1013, reason: "slow-client" }]);
  assertEquals(client.inspect().closed, true);
  assertEquals(host.inspect().sessions[0]?.attachedClients, 0);
  assertEquals(backend.handles[0]!.killCalls, 0);
  assertEquals(backend.handles[0]!.disposeCalls, 0);
  await host.shutdown();
});

Deno.test("muxstone detach cancels blocked replay before ack and permits immediate reattach", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 8, replayEntries: 16 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "detach-race" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();
  backend.handles[0]!.emit("one");
  backend.handles[0]!.emit("two");
  backend.handles[0]!.emit("three");

  const peer = new AbortableOncePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.blockNext();
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await client.receive(wire({
    version: 1,
    type: "detach",
    requestId: 2,
    sessionId: spawned.session.id,
  }));
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 3,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await waitFor(() => peer.sent.length === 7);
  await drain();

  const messages = peer.messages();
  assertEquals(messages.map((message) => message.type), [
    "ready",
    "attached",
    "ack",
    "attached",
    "output",
    "output",
    "output",
  ]);
  const detachAck = messages[2];
  assert(detachAck?.type === "ack");
  assertEquals(detachAck.operation, "detach");
  assertEquals(messages.slice(3).filter((message) => message.type === "output").map((message) => message.sequence), [
    1,
    2,
    3,
  ]);
  assertEquals(peer.closes, []);
  assertEquals(peer.abortedSends, 1);
  await host.shutdown();
});

Deno.test("muxstone kill cancels blocked replay before acknowledging session removal", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 4, replayEntries: 16 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "kill-race" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();
  backend.handles[0]!.emit("must-not-follow-kill-ack");

  const peer = new AbortableOncePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.blockNext();
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 2,
    sessionId: spawned.session.id,
  }));
  await waitFor(() => peer.sent.length === 3);
  await drain();

  const messages = peer.messages();
  assertEquals(messages.map((message) => message.type), ["ready", "attached", "ack"]);
  const killAck = messages[2];
  assert(killAck?.type === "ack");
  assertEquals(killAck.operation, "kill");
  assertEquals(host.inspect().sessions, []);
  assertEquals(backend.handles[0]!.killCalls, 1);
  assertEquals(backend.handles[0]!.disposeCalls, 1);
  assertEquals(peer.abortedSends, 1);
  await host.shutdown();
});

Deno.test("muxstone replay lanes yield to ping and list control traffic", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 4, replayEntries: 16 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "fair-control" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();
  for (let sequence = 1; sequence <= 8; sequence += 1) backend.handles[0]!.emit(`replay-${sequence}`);

  const peer = new PausablePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.pause();
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  await client.receive(wire({ version: 1, type: "ping", requestId: 2 }));
  await client.receive(wire({ version: 1, type: "list", requestId: 3 }));
  peer.resume();
  await waitFor(() => peer.sent.length === 12);

  assertEquals(peer.messages().slice(1, 5).map((message) => message.type), [
    "attached",
    "pong",
    "sessions",
    "output",
  ]);
  assertEquals(peer.closes, []);
  await host.shutdown();
});

Deno.test("muxstone closes a replay client whose blocked lane fills with live output", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 3, replayEntries: 16 });
  const ownerPeer = new FakePeer();
  const owner = host.connect(ownerPeer);
  await authenticate(owner);
  await owner.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "live-flood" }));
  await drain();
  const spawned = ownerPeer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  owner.disconnect();
  backend.handles[0]!.emit("retained");

  const peer = new PausablePeer();
  const client = host.connect(peer);
  await authenticate(client);
  peer.pause();
  await client.receive(wire({
    version: 1,
    type: "attach",
    requestId: 1,
    sessionId: spawned.session.id,
    afterSequence: 0,
  }));
  backend.handles[0]!.emit("live-one");
  backend.handles[0]!.emit("live-two");
  backend.handles[0]!.emit("live-over-quota");
  await drain();

  assertEquals(peer.closes, [{ code: 1013, reason: "slow-client" }]);
  assertEquals(client.inspect().closed, true);
  assertEquals(host.inspect().sessions[0]?.attachedClients, 0);
  assertEquals(backend.handles[0]!.killCalls, 0);
  assertEquals(backend.handles[0]!.disposeCalls, 0);
  await host.shutdown();
});

Deno.test("muxstone host routes bounded input and resize only to attached backend handle", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "interactive" }));
  await drain();
  const spawned = peer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");

  await client.receive(wire({
    version: 1,
    type: "input",
    requestId: 2,
    sessionId: spawned.session.id,
    data: encodeMuxstoneData(new Uint8Array([0x1b, 0x5b, 0x41])),
  }));
  await client.receive(wire({
    version: 1,
    type: "resize",
    requestId: 3,
    sessionId: spawned.session.id,
    columns: 132,
    rows: 41,
  }));
  await drain();

  const handle = backend.handles[0]!;
  assertEquals(handle.writes, [new Uint8Array([0x1b, 0x5b, 0x41])]);
  assertEquals(handle.resizes, [{ columns: 132, rows: 41 }]);
  assertEquals(
    peer.messages().filter((message) => message.type === "ack").map((message) => message.operation),
    ["input", "resize"],
  );

  await host.shutdown();
});

Deno.test("muxstone host rejects missing auth, wrong auth, and malformed protocol before backend calls", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);

  const missingPeer = new FakePeer();
  const missing = host.connect(missingPeer);
  await missing.receive(wire({ version: 1, type: "list", requestId: 1 }));
  assertEquals(missingPeer.closes, [{ code: 1008, reason: "auth-required" }]);

  const wrongPeer = new FakePeer();
  const wrong = host.connect(wrongPeer);
  await wrong.receive(wire({ version: 1, type: "auth", token: "cd".repeat(32) }));
  assertEquals(wrongPeer.closes, [{ code: 1008, reason: "auth-rejected" }]);

  const malformedPeer = new FakePeer();
  const malformed = host.connect(malformedPeer);
  await authenticate(malformed);
  await malformed.receive(wire({ version: 2, type: "spawn", requestId: 1, command: "bad" }));
  assertEquals(malformedPeer.closes, [{ code: 1002, reason: "protocol-error" }]);

  const extraPeer = new FakePeer();
  const extra = host.connect(extraPeer);
  await authenticate(extra);
  await extra.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "bad", surprise: true }));
  assertEquals(extraPeer.closes, [{ code: 1002, reason: "protocol-error" }]);

  const quotaPeer = new FakePeer();
  const quota = host.connect(quotaPeer);
  await authenticate(quota);
  await quota.receive(wire({
    version: 1,
    type: "spawn",
    requestId: 1,
    command: "bad",
    columns: 513,
    rows: 24,
  }));
  assertEquals(quotaPeer.closes, [{ code: 1002, reason: "protocol-error" }]);
  assertEquals(backend.spawnCalls, 0);

  await host.shutdown();
});

Deno.test("muxstone explicit kill invokes backend kill and dispose exactly once", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "long-running" }));
  await drain();
  const spawned = peer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");

  await client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 2,
    sessionId: spawned.session.id,
  }));
  await client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 3,
    sessionId: spawned.session.id,
  }));
  await drain();

  const handle = backend.handles[0]!;
  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
  assertEquals(host.inspect().sessions, []);
  assertEquals(
    peer.messages().filter((message) => message.type === "ack" && message.operation === "kill").length,
    1,
  );
  assertEquals(
    peer.messages().filter((message) => message.type === "error" && message.code === "session-not-found").length,
    1,
  );

  await host.shutdown();
  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
});

Deno.test("muxstone slow-client quota closes only the peer and retains its PTY", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend, { outboundMessages: 2, outboundBytes: 1024 * 1024 });
  const peer = new BlockingPeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "chatty" }));
  backend.handles[0]!.emit("first queued output");
  await drain();

  assertEquals(peer.closes, [{ code: 1013, reason: "slow-client" }]);
  assertEquals(backend.handles[0]!.killCalls, 0);
  assertEquals(backend.handles[0]!.disposeCalls, 0);
  assertEquals(host.inspect().sessions.length, 1);
  assertEquals(host.inspect().sessions[0]?.attachedClients, 0);

  await host.shutdown();
  assertEquals(backend.handles[0]!.killCalls, 1);
  assertEquals(backend.handles[0]!.disposeCalls, 1);
});

Deno.test("muxstone shutdown prevents a delayed backend factory from spawning afterward", async () => {
  const backend = new FakeTerminalBackend();
  const backendGate = deferred<TerminalBackend>();
  const host = createHostWithOptions({ backendFactory: () => backendGate.promise });
  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);

  const spawn = client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "late" }));
  await drain();
  await host.shutdown();
  backendGate.resolve(backend);
  await spawn;

  assertEquals(backend.spawnCalls, 0);
  assertEquals(host.inspect().running, false);
  assertEquals(host.inspect().sessions, []);
});

Deno.test("muxstone reserves async spawn slots before awaiting the shared backend", async () => {
  const backend = new FakeTerminalBackend();
  const backendGate = deferred<TerminalBackend>();
  const host = createHostWithOptions({
    backendFactory: () => backendGate.promise,
    limits: { sessions: 1 },
  });
  const firstPeer = new FakePeer();
  const secondPeer = new FakePeer();
  const first = host.connect(firstPeer);
  const second = host.connect(secondPeer);
  await authenticate(first);
  await authenticate(second);

  const firstSpawn = first.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "first" }));
  await drain();
  await second.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "second" }));
  backendGate.resolve(backend);
  await firstSpawn;
  await drain();

  assertEquals(backend.spawnCalls, 1);
  assertEquals(host.inspect().sessions.length, 1);
  assertEquals(
    secondPeer.messages().filter((message) => message.type === "error").map((message) => message.code),
    ["session-quota"],
  );
  await host.shutdown();
});

Deno.test("muxstone shutdown awaits the exact shared in-flight termination", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "slow-stop" }));
  await drain();
  const spawned = peer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  const handle = backend.handles[0]!;
  handle.killGate = deferred<boolean>();
  handle.disposeGate = deferred<void>();

  const kill = client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 2,
    sessionId: spawned.session.id,
  }));
  await drain();
  let shutdownFinished = false;
  const shutdown = host.shutdown().then(() => {
    shutdownFinished = true;
  });
  await drain();
  assertEquals(shutdownFinished, false);
  assertEquals(handle.killCalls, 1);

  handle.killGate.resolve(true);
  await drain();
  assertEquals(handle.disposeCalls, 1);
  assertEquals(shutdownFinished, false);
  handle.disposeGate.resolve();
  await Promise.all([kill, shutdown]);

  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
  assertEquals(host.inspect().sessions, []);
});

Deno.test("muxstone shutdown request delivers its acknowledgement before closing the peer", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const events: string[] = [];
  const peer = new EventPeer(events);
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "shutdown-ack" }));
  await drain();

  await client.receive(wire({ version: 1, type: "shutdown", requestId: 2 }));
  await drain();

  const acknowledgement = peer.messages().find((message) => message.type === "ack" && message.operation === "shutdown");
  assert(acknowledgement?.type === "ack");
  assertEquals(events.slice(-2), ["send:ack", "close:host-shutdown"]);
  assertEquals(peer.closes, [{ code: 1001, reason: "host-shutdown" }]);
  assertEquals(backend.handles[0]!.killCalls, 1);
  assertEquals(backend.handles[0]!.disposeCalls, 1);
  assertEquals(host.inspect().running, false);
});

Deno.test("muxstone failed disposal is reported, retained, and never double-invoked", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const peer = new FakePeer();
  const client = host.connect(peer);
  await authenticate(client);
  await client.receive(wire({ version: 1, type: "spawn", requestId: 1, command: "broken-stop" }));
  await drain();
  const spawned = peer.messages().find((message) => message.type === "spawned");
  assert(spawned?.type === "spawned");
  const handle = backend.handles[0]!;
  handle.disposeFailure = true;

  await client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 2,
    sessionId: spawned.session.id,
  }));
  await client.receive(wire({
    version: 1,
    type: "kill",
    requestId: 3,
    sessionId: spawned.session.id,
  }));
  await drain();

  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
  assertEquals(host.inspect().sessions.length, 1);
  assertEquals(
    peer.messages().filter((message) => message.type === "ack" && message.operation === "kill").length,
    0,
  );
  assertEquals(
    peer.messages().filter((message) => message.type === "error" && message.code === "termination-failed").length,
    2,
  );
  await assertRejects(() => host.shutdown());
  assertEquals(handle.killCalls, 1);
  assertEquals(handle.disposeCalls, 1);
  client.disconnect();
});

Deno.test("muxstone rejects oversized inbound bytes before they enter the request queue", async () => {
  const backend = new FakeTerminalBackend();
  const host = createHost(backend);
  const peer = new FakePeer();
  const client = host.connect(peer);

  await client.receive("x".repeat(MUXSTONE_PROTOCOL_LIMITS.messageBytes + 1));

  assertEquals(peer.closes, [{ code: 1009, reason: "message-too-large" }]);
  assertEquals(client.inspect().pendingInboundMessages, 0);
  assertEquals(client.inspect().pendingInboundBytes, 0);
  assertEquals(backend.spawnCalls, 0);
  await host.shutdown();
});

function createHost(backend: FakeTerminalBackend, limits: Record<string, number> = {}): MuxstoneHostController {
  return createHostWithOptions({ backend, limits });
}

function createHostWithOptions(
  options: Pick<ConstructorParameters<typeof MuxstoneHostController>[0], "backend" | "backendFactory" | "limits">,
): MuxstoneHostController {
  let nextId = 0;
  return new MuxstoneHostController({
    authToken: AUTH_TOKEN,
    ...options,
    now: () => 1000 + nextId,
    idFactory: () => `mux-${++nextId}`,
  });
}

async function authenticate(connection: MuxstoneHostConnection): Promise<void> {
  await connection.receive(wire({ version: 1, type: "auth", token: AUTH_TOKEN }));
  await drain();
}

function wire(message: unknown): string {
  return JSON.stringify(message);
}

async function drain(turns = 12): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}

async function waitFor(predicate: () => boolean, turns = 10_000): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for asynchronous host output.");
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class FakePeer implements MuxstoneHostPeer {
  readonly sent: string[] = [];
  readonly closes: Array<{ code: number; reason: string }> = [];

  send(message: string, _signal: AbortSignal): boolean | void | Promise<void> {
    this.sent.push(message);
  }

  close(code: number, reason: string): void {
    this.closes.push({ code, reason });
  }

  messages(): MuxstoneServerMessage[] {
    return this.sent.map(decodeMuxstoneServerMessage);
  }
}

class EventPeer extends FakePeer {
  constructor(readonly events: string[]) {
    super();
  }

  override send(message: string, signal: AbortSignal): boolean | void | Promise<void> {
    const decoded = decodeMuxstoneServerMessage(message);
    this.events.push(`send:${decoded.type}`);
    return super.send(message, signal);
  }

  override close(code: number, reason: string): void {
    this.events.push(`close:${reason}`);
    super.close(code, reason);
  }
}

class BlockingPeer extends FakePeer {
  override send(message: string): Promise<void> {
    this.sent.push(message);
    return new Promise(() => undefined);
  }
}

class PausablePeer extends FakePeer {
  #gate?: ReturnType<typeof deferred<void>>;

  pause(): void {
    this.#gate ??= deferred<void>();
  }

  resume(): void {
    this.#gate?.resolve();
    this.#gate = undefined;
  }

  override send(message: string): void | Promise<void> {
    this.sent.push(message);
    return this.#gate?.promise;
  }
}

class RejectingPeer extends FakePeer {
  reject = false;

  override send(message: string): boolean | void {
    if (this.reject) return false;
    this.sent.push(message);
  }
}

class AbortableOncePeer extends FakePeer {
  #blockNext = false;
  abortedSends = 0;

  blockNext(): void {
    this.#blockNext = true;
  }

  override send(message: string, signal: AbortSignal): void | Promise<void> {
    this.sent.push(message);
    if (!this.#blockNext) return;
    this.#blockNext = false;
    return new Promise((resolve) => {
      const aborted = () => {
        this.abortedSends += 1;
        resolve();
      };
      if (signal.aborted) aborted();
      else signal.addEventListener("abort", aborted, { once: true });
    });
  }
}

class FakeTerminalBackend implements TerminalBackend {
  readonly id = "fake-pty";
  readonly label = "Fake PTY";
  readonly pty = true;
  readonly detachable = false;
  readonly reconnectable = false;
  readonly handles: FakeTerminalHandle[] = [];
  spawnCalls = 0;

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    this.spawnCalls += 1;
    const handle = new FakeTerminalHandle(options, this.handles.length + 1);
    this.handles.push(handle);
    return handle;
  }
}

class FakeTerminalHandle implements TerminalSessionHandle {
  readonly id: string;
  readonly backendId = "fake-pty";
  readonly command: ProcessSessionCommand;
  readonly output = new TerminalOutputController();
  readonly closed: Promise<ProcessSessionInspection>;
  readonly writes: Uint8Array[] = [];
  readonly resizes: Array<{ columns: number; rows: number }> = [];
  readonly #onData?: TerminalBackendSpawnOptions["onData"];
  #resolveClosed!: (inspection: ProcessSessionInspection) => void;
  #status: ProcessSessionStatus = "running";
  #columns: number;
  #rows: number;
  killCalls = 0;
  disposeCalls = 0;
  killGate?: ReturnType<typeof deferred<boolean>>;
  disposeGate?: ReturnType<typeof deferred<void>>;
  disposeFailure = false;
  title: string;

  constructor(options: TerminalBackendSpawnOptions, index: number) {
    this.id = `fake-handle-${index}`;
    this.command = {
      command: options.command,
      ...(options.args ? { args: [...options.args] } : {}),
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: { ...options.env } } : {}),
    };
    this.#columns = options.columns ?? 80;
    this.#rows = options.rows ?? 24;
    this.#onData = options.onData;
    this.title = options.command;
    this.closed = new Promise((resolve) => {
      this.#resolveClosed = resolve;
    });
  }

  emit(data: string | Uint8Array): void {
    this.#onData?.(data, "stdout");
  }

  write(data: string | Uint8Array): Promise<boolean> {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    this.writes.push(bytes);
    return Promise.resolve(this.#status === "running");
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = columns;
    this.#rows = rows;
    this.resizes.push({ columns, rows });
    return Promise.resolve(this.#status === "running");
  }

  kill(): Promise<boolean> {
    this.killCalls += 1;
    if (this.killGate) return this.killGate.promise.then((accepted) => this.finishKill(accepted));
    return Promise.resolve(this.finishKill(this.#status === "running"));
  }

  inspect(): TerminalSessionHandleInspection {
    return {
      id: this.id,
      backendId: this.backendId,
      pty: true,
      title: this.title,
      commandLine: [this.command.command, ...(this.command.args ?? [])].join(" "),
      status: this.#status,
      running: this.#status === "running",
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: true,
    };
  }

  dispose(): Promise<void> {
    this.disposeCalls += 1;
    if (this.disposeFailure) return Promise.reject(new Error("fake dispose failed"));
    return this.disposeGate?.promise ?? Promise.resolve();
  }

  private finishKill(accepted: boolean): boolean {
    if (!accepted || this.#status !== "running") return false;
    this.#status = "cancelled";
    this.#resolveClosed(this.processInspection());
    return true;
  }

  private processInspection(): ProcessSessionInspection {
    return {
      command: this.command,
      commandLine: [this.command.command, ...(this.command.args ?? [])].join(" "),
      status: this.#status,
      running: false,
      output: this.output.inspect(),
    };
  }
}
