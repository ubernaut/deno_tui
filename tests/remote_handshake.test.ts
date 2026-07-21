import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  decodeRemoteHandshakeMessage,
  encodeRemoteHandshakeMessage,
  normalizeRemoteCapabilityManifest,
  normalizeRemoteHandshakeMessage,
  RemoteCapabilityHandshake,
  type RemoteCapabilityManifest,
  type RemoteHandshakeAck,
  RemoteHandshakeError,
  type RemoteHandshakeHello,
  resolveRemoteHandshakeLimits,
} from "../src/remote/handshake.ts";

const manifest = (
  major: number,
  minor: number,
  mandatory: readonly string[] = ["terminal.input"],
  optional: readonly string[] = [],
): RemoteCapabilityManifest => ({ protocol: { major, minor }, mandatory, optional });

const hello = (
  value: RemoteCapabilityManifest,
): RemoteHandshakeHello => ({
  type: "remote.handshake.hello",
  schemaVersion: 1,
  protocol: value.protocol,
  capabilities: { mandatory: value.mandatory, optional: value.optional },
});

const ack = (minor: number, capabilities: readonly string[]): RemoteHandshakeAck => ({
  type: "remote.handshake.ack",
  schemaVersion: 1,
  protocol: { major: 1, minor },
  capabilities,
});

Deno.test("remote handshake deterministically negotiates minor and sorted optional intersection", () => {
  const initiator = new RemoteCapabilityHandshake({
    role: "initiator",
    manifest: manifest(1, 7, ["terminal.input"], ["terminal.resize", "terminal.binary", "client.only"]),
  });
  const acceptor = new RemoteCapabilityHandshake({
    role: "acceptor",
    manifest: manifest(1, 4, ["terminal.input"], ["server.only", "terminal.binary", "terminal.resize"]),
  });

  const accepted = acceptor.receive(initiator.start());
  assertEquals(accepted.state, "ready");
  assertEquals(accepted.negotiated, {
    protocol: { major: 1, minor: 4 },
    capabilities: ["terminal.binary", "terminal.input", "terminal.resize"],
  });
  assert(accepted.response?.type === "remote.handshake.ack");
  const completed = initiator.receive(accepted.response);
  assertEquals(completed.state, "ready");
  assertEquals(completed.negotiated, accepted.negotiated);
});

Deno.test("remote handshake rejects incompatible protocol major with machine-readable versions", () => {
  const acceptor = new RemoteCapabilityHandshake({ role: "acceptor", manifest: manifest(2, 0) });
  const result = acceptor.receive(hello(manifest(1, 99)));

  assertEquals(result.state, "rejected");
  assertEquals(result.response?.type, "remote.handshake.reject");
  assertEquals(result.rejection, {
    code: "incompatible-major",
    message: "protocol major 1 is incompatible with 2",
    localProtocol: { major: 2, minor: 0 },
    peerProtocol: { major: 1, minor: 99 },
  });
});

Deno.test("remote handshake enforces mandatory capabilities from both peers", () => {
  const serverRequirement = new RemoteCapabilityHandshake({
    role: "acceptor",
    manifest: manifest(1, 0, ["terminal.input", "terminal.output"]),
  });
  assertEquals(
    serverRequirement.receive(hello(manifest(1, 0, ["terminal.input"]))).rejection?.capabilities,
    ["terminal.output"],
  );

  const clientRequirement = new RemoteCapabilityHandshake({
    role: "acceptor",
    manifest: manifest(1, 0, ["terminal.input"]),
  });
  assertEquals(
    clientRequirement.receive(hello(manifest(1, 0, ["terminal.input", "terminal.output"]))).rejection
      ?.capabilities,
    ["terminal.output"],
  );
});

Deno.test("remote handshake bounds combined missing-capability diagnostics", () => {
  const acceptor = new RemoteCapabilityHandshake({
    role: "acceptor",
    manifest: manifest(1, 0, ["local.a", "local.b"]),
    limits: { maxCapabilities: 2 },
  });

  const result = acceptor.receive(hello(manifest(1, 0, ["peer.a", "peer.b"])));

  assertEquals(result.state, "rejected");
  assertEquals(result.rejection?.code, "missing-mandatory-capability");
  assertEquals(result.rejection?.capabilities, ["local.a", "local.b"]);
  assertEquals(result.response?.type, "remote.handshake.reject");
  assertEquals(acceptor.inspect().state, "rejected");
});

Deno.test("remote handshake initiator rejects invalid acknowledgements", () => {
  const unsupported = new RemoteCapabilityHandshake({
    role: "initiator",
    manifest: manifest(1, 2, ["terminal.input"], ["terminal.resize"]),
  });
  unsupported.start();
  assertEquals(
    unsupported.receive(ack(2, ["terminal.input", "terminal.unknown"])).rejection?.code,
    "invalid-negotiation",
  );

  const missing = new RemoteCapabilityHandshake({ role: "initiator", manifest: manifest(1, 2) });
  missing.start();
  assertEquals(missing.receive(ack(2, [])).rejection?.code, "missing-mandatory-capability");

  const futureMinor = new RemoteCapabilityHandshake({ role: "initiator", manifest: manifest(1, 2) });
  futureMinor.start();
  assertEquals(futureMinor.receive(ack(3, ["terminal.input"])).rejection?.code, "invalid-negotiation");
});

Deno.test("remote handshake rejects duplicate and conflicting capability declarations", () => {
  const duplicate = assertThrows(
    () => normalizeRemoteCapabilityManifest(manifest(1, 0, ["terminal.input", "terminal.input"])),
    RemoteHandshakeError,
  );
  assertEquals(duplicate.code, "duplicate-capability");

  const conflict = assertThrows(
    () => normalizeRemoteCapabilityManifest(manifest(1, 0, ["terminal.input"], ["terminal.input"])),
    RemoteHandshakeError,
  );
  assertEquals(conflict.code, "conflicting-capability");
});

Deno.test("remote handshake rejects sparse, extra-property, malformed, and overlong capability lists", () => {
  const sparse = new Array<string>(1);
  assertEquals(
    assertThrows(() => normalizeRemoteCapabilityManifest(manifest(1, 0, sparse)), RemoteHandshakeError).code,
    "invalid-shape",
  );

  const extra = ["terminal.input"];
  Object.defineProperty(extra, "extra", { value: true, enumerable: true });
  assertEquals(
    assertThrows(() => normalizeRemoteCapabilityManifest(manifest(1, 0, extra)), RemoteHandshakeError).code,
    "invalid-shape",
  );
  assertEquals(
    assertThrows(() => normalizeRemoteCapabilityManifest(manifest(1, 0, ["Bad Capability"])), RemoteHandshakeError)
      .code,
    "invalid-value",
  );
  assertEquals(
    assertThrows(
      () => normalizeRemoteCapabilityManifest(manifest(1, 0, ["terminal.input"]), { maxCapabilityLength: 3 }),
      RemoteHandshakeError,
    ).code,
    "invalid-value",
  );
});

Deno.test("remote handshake validation does not invoke object getters or proxy get traps", () => {
  let getterCalls = 0;
  const accessor: Record<string, unknown> = {
    schemaVersion: 1,
    protocol: { major: 1, minor: 0 },
    capabilities: { mandatory: ["terminal.input"], optional: [] },
  };
  Object.defineProperty(accessor, "type", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "remote.handshake.hello";
    },
  });
  assertThrows(() => normalizeRemoteHandshakeMessage(accessor), RemoteHandshakeError);
  assertEquals(getterCalls, 0);

  let getTrapCalls = 0;
  const proxied = new Proxy(hello(manifest(1, 0)), {
    get(target, property, receiver) {
      getTrapCalls += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assertEquals(normalizeRemoteHandshakeMessage(proxied).type, "remote.handshake.hello");
  assertEquals(getTrapCalls, 0);
});

Deno.test("remote handshake normalizes revoked and throwing proxy reflection failures", () => {
  const revokedObject = Proxy.revocable({}, {});
  revokedObject.revoke();
  const objectFailure = assertThrows(
    () => normalizeRemoteHandshakeMessage(revokedObject.proxy),
    RemoteHandshakeError,
  );
  assertEquals(objectFailure.code, "invalid-shape");

  const revokedArray = Proxy.revocable<string[]>([], {});
  revokedArray.revoke();
  const arrayFailure = assertThrows(
    () => normalizeRemoteCapabilityManifest(manifest(1, 0, revokedArray.proxy)),
    RemoteHandshakeError,
  );
  assertEquals(arrayFailure.code, "invalid-shape");

  const throwingArray = new Proxy<string[]>([], {
    getPrototypeOf() {
      throw new Error("hostile prototype trap");
    },
  });
  const prototypeFailure = assertThrows(
    () => normalizeRemoteCapabilityManifest(manifest(1, 0, throwingArray)),
    RemoteHandshakeError,
  );
  assertEquals(prototypeFailure.code, "invalid-shape");

  const secondTrap = new Proxy({}, {
    getPrototypeOf() {
      throw new Error("second prototype trap");
    },
  });
  const proxyThrowingProxy = new Proxy<string[]>([], {
    getPrototypeOf() {
      throw secondTrap;
    },
  });
  const nestedPrototypeFailure = assertThrows(
    () => normalizeRemoteCapabilityManifest(manifest(1, 0, proxyThrowingProxy)),
    RemoteHandshakeError,
  );
  assertEquals(nestedPrototypeFailure.code, "invalid-shape");
});

Deno.test("remote handshake never coerces a hostile schema version", () => {
  let coercionCalls = 0;
  const hostileSchemaVersion = {
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      throw new Error("schema coercion must not run");
    },
  };
  const failure = assertThrows(
    () => normalizeRemoteHandshakeMessage({ ...hello(manifest(1, 0)), schemaVersion: hostileSchemaVersion }),
    RemoteHandshakeError,
  );
  assertEquals(failure.code, "unsupported-version");
  assertEquals(coercionCalls, 0);
});

Deno.test("remote handshake wire decoding bounds bytes and rejects invalid UTF-8", () => {
  assertEquals(
    assertThrows(() => decodeRemoteHandshakeMessage(" ".repeat(65), { maxMessageBytes: 64 }), RemoteHandshakeError)
      .code,
    "limit-exceeded",
  );
  assertEquals(
    assertThrows(() => decodeRemoteHandshakeMessage(new Uint8Array([0xc3, 0x28])), RemoteHandshakeError).code,
    "invalid-value",
  );

  const encoded = encodeRemoteHandshakeMessage(hello(manifest(1, 0)));
  assertEquals(decodeRemoteHandshakeMessage(encoded), hello(manifest(1, 0)));
});

Deno.test("remote handshake wire decoding normalizes hostile Uint8Array wrappers without invoking getters", () => {
  const revoked = Proxy.revocable(new Uint8Array(), {});
  revoked.revoke();
  assertEquals(
    assertThrows(() => decodeRemoteHandshakeMessage(revoked.proxy), RemoteHandshakeError).code,
    "invalid-shape",
  );

  const prototypeTrap = new Proxy(new Uint8Array(), {
    getPrototypeOf() {
      throw new Error("wire prototype trap");
    },
  });
  assertEquals(
    assertThrows(() => decodeRemoteHandshakeMessage(prototypeTrap), RemoteHandshakeError).code,
    "invalid-shape",
  );

  let byteLengthGetterCalls = 0;
  const encoded = new TextEncoder().encode(encodeRemoteHandshakeMessage(hello(manifest(1, 0))));
  Object.defineProperty(encoded, "byteLength", {
    configurable: true,
    get() {
      byteLengthGetterCalls += 1;
      throw new Error("own byteLength getter must not run");
    },
  });
  assertEquals(decodeRemoteHandshakeMessage(encoded), hello(manifest(1, 0)));
  assertEquals(byteLengthGetterCalls, 0);
});

Deno.test("remote handshake configuration cannot disable allocation ceilings", () => {
  assertEquals(
    assertThrows(
      () => resolveRemoteHandshakeLimits({ maxMessageBytes: 1024 * 1024 + 1 }),
      RemoteHandshakeError,
    ).code,
    "invalid-value",
  );
  assertEquals(
    assertThrows(() => resolveRemoteHandshakeLimits({ maxCapabilities: 1025 }), RemoteHandshakeError).code,
    "invalid-value",
  );
  assertEquals(
    assertThrows(() => resolveRemoteHandshakeLimits({ maxCapabilityLength: 257 }), RemoteHandshakeError).code,
    "invalid-value",
  );
  assertEquals(
    assertThrows(() => resolveRemoteHandshakeLimits({ maxRejectionMessageLength: 1025 }), RemoteHandshakeError).code,
    "invalid-value",
  );
});

Deno.test("remote handshake rejects unknown fields and unsupported schema versions", () => {
  assertEquals(
    assertThrows(
      () => normalizeRemoteHandshakeMessage({ ...hello(manifest(1, 0)), extension: true }),
      RemoteHandshakeError,
    ).code,
    "unknown-field",
  );
  assertEquals(
    assertThrows(
      () => normalizeRemoteHandshakeMessage({ ...hello(manifest(1, 0)), schemaVersion: 2 }),
      RemoteHandshakeError,
    ).code,
    "unsupported-version",
  );
});

Deno.test("remote handshake duplicate hello and ack fail closed", () => {
  const acceptor = new RemoteCapabilityHandshake({ role: "acceptor", manifest: manifest(1, 0) });
  acceptor.receive(hello(manifest(1, 0)));
  const duplicateHello = acceptor.receive(hello(manifest(1, 0)));
  assertEquals(duplicateHello.rejection?.code, "duplicate-handshake");

  const initiator = new RemoteCapabilityHandshake({ role: "initiator", manifest: manifest(1, 0) });
  initiator.start();
  initiator.receive(ack(0, ["terminal.input"]));
  const duplicateAck = initiator.receive(ack(0, ["terminal.input"]));
  assertEquals(duplicateAck.rejection?.code, "duplicate-handshake");
});

Deno.test("remote handshake inspection is a deeply frozen clone and disposal is idempotent", () => {
  const source = manifest(1, 1, ["terminal.input"], ["terminal.resize"]);
  const controller = new RemoteCapabilityHandshake({ role: "initiator", manifest: source });
  const inspection = controller.inspect();

  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.manifest));
  assert(Object.isFrozen(inspection.manifest.protocol));
  assert(Object.isFrozen(inspection.manifest.mandatory));
  assertNotMutable(inspection.manifest.mandatory);
  (source.optional as string[]).push("source.changed");
  assertEquals(controller.inspect().manifest.optional, ["terminal.resize"]);

  controller.dispose();
  controller.dispose();
  assertEquals(controller.inspect().state, "disposed");
  assertEquals(assertThrows(() => controller.start(), RemoteHandshakeError).code, "disposed");
});

function assertNotMutable(value: readonly string[]): void {
  assertThrows(() => (value as string[]).push("changed"), TypeError);
}
