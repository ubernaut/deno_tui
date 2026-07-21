import {
  assert,
  assertEquals,
  assertNotStrictEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
} from "./deps.ts";
import { ActionJournal } from "../src/app/action_journal.ts";
import {
  formatRedactedError,
  inspectRedactedError,
  inspectSecret,
  isSecret,
  redactForHistory,
  redactForLog,
  redactForPersistence,
  type RedactionSchema,
  redactStructured,
  Secret,
  secret,
  SECRET_REDACTED_MARKER,
  SecretError,
  stringifyRedacted,
} from "../src/secrets.ts";

const DENO_CUSTOM_INSPECT = Symbol.for("Deno.customInspect");
const NODE_CUSTOM_INSPECT = Symbol.for("nodejs.util.inspect.custom");

function assertPlaintextAbsent(plaintext: string, ...outputs: unknown[]): void {
  for (const output of outputs) {
    const rendered = typeof output === "string" ? output : JSON.stringify(output);
    assert(!rendered.includes(plaintext), `plaintext found in ${rendered}`);
  }
}

Deno.test("opaque secrets redact every implicit formatting and inspection surface", () => {
  const plaintext = "swordfish-sec-008-never-print";
  const value = secret(plaintext);

  assertEquals(Object.keys(value), []);
  assertEquals(Reflect.ownKeys(value), []);
  assertEquals(Object.getOwnPropertyDescriptors(value) as object, {});
  assertEquals(Object.isFrozen(value), true);
  assertEquals(isSecret(value), true);
  assertEquals(isSecret({}), false);
  assertEquals(String(value), SECRET_REDACTED_MARKER);
  assertEquals(`${value}`, SECRET_REDACTED_MARKER);
  assertEquals(value.valueOf(), SECRET_REDACTED_MARKER);
  assertEquals(value.toJSON(), SECRET_REDACTED_MARKER);
  assertEquals(JSON.stringify(value), JSON.stringify(SECRET_REDACTED_MARKER));
  assertEquals(JSON.stringify({ value }), `{"value":"${SECRET_REDACTED_MARKER}"}`);
  assertEquals(Deno.inspect(value), SECRET_REDACTED_MARKER);
  assertEquals(
    (value as unknown as Record<symbol, () => string>)[DENO_CUSTOM_INSPECT](),
    SECRET_REDACTED_MARKER,
  );
  assertEquals(
    (value as unknown as Record<symbol, () => string>)[NODE_CUSTOM_INSPECT](),
    SECRET_REDACTED_MARKER,
  );
  assertEquals(inspectSecret(value), { redacted: SECRET_REDACTED_MARKER, disposed: false });

  const nativeClone = structuredClone(value);
  assertEquals(nativeClone as unknown, {});
  assertPlaintextAbsent(
    plaintext,
    String(value),
    `${value}`,
    JSON.stringify(value),
    JSON.stringify({ value }),
    Deno.inspect(value),
    nativeClone,
    inspectSecret(value),
  );
});

Deno.test("reveal is callback-only and sanitizes callback failures", () => {
  const plaintext = "callback-private-value";
  const value = Secret.create(plaintext);
  let seen = "";
  const derivative = value.reveal((revealed) => {
    seen = revealed;
    return revealed.length;
  });

  assertEquals(seen, plaintext);
  assertEquals(derivative, plaintext.length);
  assertEquals(isSecret(derivative), false);
  assertEquals(Reflect.ownKeys(value), []);
  assertEquals(String(value), SECRET_REDACTED_MARKER);

  const failure = assertThrows(
    () =>
      value.reveal(() => {
        throw new Error(`callback failed with ${plaintext}`);
      }),
    SecretError,
  );
  assertEquals(failure.code, "reveal-callback-failed");
  assertEquals(Object.hasOwn(failure, "cause"), false);
  assertPlaintextAbsent(
    plaintext,
    failure.message,
    failure.stack ?? "",
    String(failure),
    JSON.stringify(failure),
    Deno.inspect(failure),
  );

  const invalid = assertThrows(
    () => value.reveal(null as unknown as (revealed: string) => string),
    SecretError,
  );
  assertEquals(invalid.code, "invalid-callback");
});

Deno.test("reveal sanitizes rejecting custom thenables", async () => {
  const plaintext = "custom-thenable-private-value";
  const value = secret(plaintext);
  const rejectingThenable = {
    then(
      _resolve: (result: never) => unknown,
      reject: (reason: unknown) => unknown,
    ): void {
      reject(new Error(`thenable rejected with ${plaintext}`));
    },
  } as unknown as PromiseLike<never>;

  const failure = await assertRejects(
    () => value.reveal(() => rejectingThenable),
    SecretError,
  );
  assertEquals(failure.code, "reveal-callback-failed");
  assertPlaintextAbsent(
    plaintext,
    failure.message,
    failure.stack ?? "",
    String(failure),
    Deno.inspect(failure),
  );
});

Deno.test("reveal sanitizes rejection from nested thenable assimilation", async () => {
  const plaintext = "nested-thenable-private-value";
  const value = secret(plaintext);
  const nested = {
    then(
      _resolve: (result: never) => unknown,
      reject: (reason: unknown) => unknown,
    ): void {
      reject(new Error(`nested thenable rejected with ${plaintext}`));
    },
  } as unknown as PromiseLike<never>;
  const outer = {
    then(resolve: (result: PromiseLike<never>) => unknown): void {
      resolve(nested);
    },
  } as unknown as PromiseLike<never>;

  const failure = await assertRejects(
    () => value.reveal(() => outer),
    SecretError,
  );
  assertEquals(failure.code, "reveal-callback-failed");
  assertPlaintextAbsent(
    plaintext,
    failure.message,
    failure.stack ?? "",
    String(failure),
    Deno.inspect(failure),
  );
});

Deno.test("byte secrets clone input and reveals, then dispose idempotently", () => {
  const input = new Uint8Array([1, 2, 3]);
  const value = secret(input);
  input[0] = 99;

  const first = value.reveal((bytes) => bytes);
  assertEquals(first, new Uint8Array([1, 2, 3]));
  assertNotStrictEquals(first, input);
  first[1] = 88;
  const second = value.reveal((bytes) => bytes);
  assertEquals(second, new Uint8Array([1, 2, 3]));
  assertNotStrictEquals(first, second);

  value.dispose();
  value.dispose();
  assertEquals(value.disposed, true);
  assertEquals(inspectSecret(value), { redacted: SECRET_REDACTED_MARKER, disposed: true });
  assertEquals(String(value), SECRET_REDACTED_MARKER);
  const disposed = assertThrows(() => value.reveal((bytes) => bytes), SecretError);
  assertEquals(disposed.code, "disposed");
});

Deno.test("default log, persistence, and history projections detach and redact secrets", () => {
  const plaintext = "journal-secret-plaintext";
  const source = {
    z: secret(plaintext),
    nested: { visible: 3, credentials: [secret(plaintext)] },
  };
  const persistence = redactForPersistence(source);
  const history = redactForHistory(source);
  const log = redactForLog(source);

  const expected = {
    nested: { credentials: [SECRET_REDACTED_MARKER], visible: 3 },
    z: SECRET_REDACTED_MARKER,
  };
  assertEquals(persistence, expected);
  assertEquals(history, expected);
  assertEquals(log, expected);
  assertNotStrictEquals(persistence as unknown, source as unknown);
  assertEquals(Object.isFrozen(persistence), true);
  assertEquals(Object.isFrozen((persistence as typeof expected).nested), true);

  const journal = new ActionJournal<unknown>({ journalId: "secret-history", now: () => 7 });
  journal.append(history);
  const serialized = journal.serialize();
  assertStringIncludes(serialized, SECRET_REDACTED_MARKER);
  assertPlaintextAbsent(
    plaintext,
    persistence,
    history,
    log,
    stringifyRedacted(source),
    serialized,
  );
});

Deno.test("schema paths support deterministic nesting, indexes, and wildcards", () => {
  const plaintext = "ordinary-token-should-redact";
  const source = {
    requestId: "req-1",
    users: [
      {
        id: 1,
        token: plaintext,
        profile: { email: "a@example.test", nickname: "alpha" },
        unknown: "hide-a",
      },
      {
        id: 2,
        token: "second-token",
        profile: { email: "b@example.test", nickname: "beta" },
        unknown: "hide-b",
      },
    ],
    unknownRoot: "hide-root",
  };
  const schema: RedactionSchema = {
    rules: [
      { path: ["requestId"], action: "allow" },
      { path: ["users", "*", "id"], action: "allow" },
      { path: ["users", "*", "token"], action: "secret" },
      { path: ["users", "*", "profile", "email"], action: "allow" },
    ],
  };
  const expected = {
    requestId: "req-1",
    unknownRoot: SECRET_REDACTED_MARKER,
    users: [
      {
        id: 1,
        profile: { email: "a@example.test", nickname: SECRET_REDACTED_MARKER },
        token: SECRET_REDACTED_MARKER,
        unknown: SECRET_REDACTED_MARKER,
      },
      {
        id: 2,
        profile: { email: "b@example.test", nickname: SECRET_REDACTED_MARKER },
        token: SECRET_REDACTED_MARKER,
        unknown: SECRET_REDACTED_MARKER,
      },
    ],
  };

  assertEquals(redactStructured(source, { schema }), expected);
  assertEquals(
    redactStructured(source, { schema: { ...schema, rules: [...schema.rules].reverse() } }),
    expected,
  );
  assertPlaintextAbsent(plaintext, redactStructured(source, { schema }));
});

Deno.test("unknown and conflicting annotations fail closed", () => {
  const source = { public: "okay", token: "plain-token", other: "other-value" };
  const unknownAction = {
    rules: [
      { path: ["public"], action: "allow" },
      { path: ["token"], action: "future-sensitive-action" },
      { path: ["other"], action: "allow" },
      { path: ["other"], action: "secret" },
    ],
  } as unknown as RedactionSchema;
  assertEquals(redactStructured(source, { schema: unknownAction }), {
    other: SECRET_REDACTED_MARKER,
    public: "okay",
    token: SECRET_REDACTED_MARKER,
  });

  const defaultAllow: RedactionSchema = {
    defaultAction: "allow",
    rules: [{ path: ["token"], action: "secret" }],
  };
  assertEquals(redactStructured(source, { schema: defaultAllow }), {
    other: "other-value",
    public: "okay",
    token: SECRET_REDACTED_MARKER,
  });
});

Deno.test("strict redaction rejects hostile values without invoking user code", () => {
  const plaintext = "getter-must-not-run-or-print";
  let getterInvoked = false;
  const accessor = {
    safe: 1,
    get credential(): string {
      getterInvoked = true;
      throw new Error(plaintext);
    },
  };
  const accessorFailure = assertThrows(() => redactStructured(accessor), SecretError);
  assertEquals(accessorFailure.code, "accessor");
  assertEquals(getterInvoked, false);
  assertPlaintextAbsent(plaintext, accessorFailure.message, accessorFailure.stack ?? "");

  let coercionInvoked = false;
  const withCoercion = {
    value: 1,
    toString() {
      coercionInvoked = true;
      return plaintext;
    },
  };
  assertEquals(assertThrows(() => redactStructured(withCoercion), SecretError).code, "invalid-value");
  assertEquals(coercionInvoked, false);

  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertEquals(assertThrows(() => redactStructured(cycle), SecretError).code, "cycle");
  assertEquals(assertThrows(() => redactStructured(new Date()), SecretError).code, "exotic");
  assertEquals(assertThrows(() => redactStructured(new Map()), SecretError).code, "exotic");
  assertEquals(assertThrows(() => redactStructured(Number.NaN), SecretError).code, "invalid-value");

  const sparse = new Array(1);
  assertEquals(assertThrows(() => redactStructured(sparse), SecretError).code, "invalid-value");
  const extra = [1] as unknown[] & { extra?: number };
  extra.extra = 2;
  assertEquals(assertThrows(() => redactStructured(extra), SecretError).code, "exotic");
  const hidden = { visible: true };
  Object.defineProperty(hidden, "hidden", { value: plaintext, enumerable: false });
  assertEquals(assertThrows(() => redactStructured(hidden), SecretError).code, "accessor");
  const symbolProperty = { visible: true } as Record<PropertyKey, unknown>;
  symbolProperty[Symbol("hidden")] = plaintext;
  assertEquals(assertThrows(() => redactStructured(symbolProperty), SecretError).code, "invalid-value");
  const polluted = JSON.parse(`{"__proto__":{"value":"${plaintext}"}}`);
  const unsafe = assertThrows(() => redactStructured(polluted), SecretError);
  assertEquals(unsafe.code, "unsafe-key");
  assertPlaintextAbsent(plaintext, unsafe.message, unsafe.stack ?? "");
});

Deno.test("redaction traversal and output limits are exact and validated", () => {
  assertEquals(redactStructured({ value: 1 }, { limits: { maxDepth: 1, maxNodes: 2 } }), { value: 1 });
  assertEquals(
    assertThrows(() => redactStructured({ value: 1 }, { limits: { maxDepth: 0 } }), SecretError).code,
    "max-depth",
  );
  assertEquals(
    assertThrows(() => redactStructured({ value: 1 }, { limits: { maxNodes: 1 } }), SecretError).code,
    "max-nodes",
  );

  const byteValue = { value: "two-byte-é" };
  const rendered = stringifyRedacted(byteValue);
  const byteLength = new TextEncoder().encode(rendered).byteLength;
  assertEquals(stringifyRedacted(byteValue, { limits: { maxBytes: byteLength } }), rendered);
  assertEquals(
    assertThrows(
      () => stringifyRedacted(byteValue, { limits: { maxBytes: byteLength - 1 } }),
      SecretError,
    ).code,
    "max-bytes",
  );

  for (
    const limits of [
      { maxDepth: -1 },
      { maxDepth: 1.5 },
      { maxNodes: 0 },
      { maxBytes: Number.NaN },
    ]
  ) {
    assertEquals(
      assertThrows(() => redactStructured(null, { limits }), SecretError).code,
      "invalid-limit",
    );
  }
});

Deno.test("safe error projections never inspect hostile error values", () => {
  const plaintext = "error-private-message";
  let getterInvoked = false;
  const hostile = Object.defineProperty({}, "message", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return plaintext;
    },
  });

  const formatted = formatRedactedError(hostile);
  const inspected = inspectRedactedError(hostile);
  assertEquals(formatted, `Error: ${SECRET_REDACTED_MARKER}`);
  assertEquals(inspected, { message: SECRET_REDACTED_MARKER });
  assertEquals(getterInvoked, false);
  assertPlaintextAbsent(plaintext, formatted, inspected);
  assertEquals(Object.isFrozen(inspected), true);
});

Deno.test("inspection does not disclose secret value type or byte length", () => {
  const text = secret("text-secret");
  const bytes = secret(new Uint8Array(1_024));
  const object = secret({ deeply: { private: true } });

  assertEquals(inspectSecret(text), inspectSecret(bytes));
  assertEquals(inspectSecret(bytes), inspectSecret(object));
  assertStrictEquals(Deno.inspect(text), Deno.inspect(bytes));
  assertStrictEquals(Deno.inspect(bytes), Deno.inspect(object));
});
