import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  createRuntimePermissionActivationReport,
  createRuntimePermissionActivationReportFromReporters,
  createRuntimePermissionManifest,
  inspectRuntimePermissionManifest,
  normalizeRuntimePermissionManifest,
  parseRuntimePermissionManifest,
  resolveRuntimePermissionManifestLimits,
  RUNTIME_PERMISSION_KINDS,
  RuntimePermissionManifestError,
  type RuntimePermissionReporter,
  type RuntimePermissionRequirement,
  serializeRuntimePermissionManifest,
} from "../src/permissions.ts";

Deno.test("runtime permission manifests cover every declared host authority before activation", () => {
  assertEquals(RUNTIME_PERMISSION_KINDS, [
    "read",
    "write",
    "network",
    "environment",
    "subprocess",
    "ffi",
    "clipboard",
    "notifications",
    "remote-session",
  ]);
  assert(Object.isFrozen(RUNTIME_PERMISSION_KINDS));
  assertThrows(() => (RUNTIME_PERMISSION_KINDS as unknown as string[]).pop(), TypeError);
  const manifest = createRuntimePermissionManifest({
    adapterId: "complete.adapter",
    required: [
      { kind: "remote-session", operation: "control", target: "session:*" },
      { kind: "read", operation: "content", target: "/workspace" },
      { kind: "write", operation: "modify", target: "/workspace" },
      { kind: "network", operation: "connect", target: "https://example.test" },
      { kind: "environment", operation: "read", target: "TERM" },
      { kind: "subprocess", operation: "spawn", target: "git" },
      { kind: "ffi", operation: "load", target: "libexample" },
      { kind: "clipboard", operation: "write", target: "system" },
      { kind: "notifications", operation: "show", target: "desktop" },
    ],
  });

  assertEquals(manifest.schemaVersion, 1);
  assertEquals(manifest.required.map((requirement) => requirement.kind), [...RUNTIME_PERMISSION_KINDS]);
  assertEquals(manifest.optional, []);
  assert(Object.isFrozen(manifest));
  assert(Object.isFrozen(manifest.required));
  assert(manifest.required.every(Object.isFrozen));

  const adapter = { permissionManifest: manifest } satisfies RuntimePermissionReporter;
  assertEquals(adapter.permissionManifest.adapterId, "complete.adapter");
});

Deno.test("manifest creation detaches caller input and serializes canonically", () => {
  const first = { kind: "network", operation: "connect", target: "https://example.test" } as const;
  const required = [first];
  const optional: RuntimePermissionRequirement[] = [
    { kind: "clipboard", operation: "read", target: "system" },
  ];
  const manifest = createRuntimePermissionManifest({ adapterId: "network.adapter", required, optional });

  required.length = 0;
  optional[0] = { kind: "clipboard", operation: "read", target: "primary" };
  assertEquals(manifest.required[0], first);
  assertEquals(manifest.optional[0]?.target, "system");

  const serialized = serializeRuntimePermissionManifest(manifest);
  assertEquals(parseRuntimePermissionManifest(serialized), manifest);
  assertEquals(JSON.stringify(inspectRuntimePermissionManifest(manifest)), serialized);
  assert(manifest !== inspectRuntimePermissionManifest(manifest));
});

Deno.test("activation reports aggregate provenance with required precedence", () => {
  const alpha = createRuntimePermissionManifest({
    adapterId: "alpha",
    required: [{ kind: "network", operation: "connect", target: "https://example.test" }],
    optional: [{ kind: "clipboard", operation: "read", target: "system" }],
  });
  const beta = createRuntimePermissionManifest({
    adapterId: "beta",
    required: [{ kind: "read", operation: "content", target: "/workspace" }],
    optional: [
      { kind: "network", operation: "connect", target: "https://example.test" },
      { kind: "clipboard", operation: "read", target: "system" },
    ],
  });
  const report = createRuntimePermissionActivationReport([beta, alpha]);

  assertEquals(report.adapterCount, 2);
  assertEquals(report.adapters.map((manifest) => manifest.adapterId), ["alpha", "beta"]);
  assertEquals(report.required, [
    {
      kind: "read",
      operation: "content",
      target: "/workspace",
      level: "required",
      requiredBy: ["beta"],
      optionalBy: [],
    },
    {
      kind: "network",
      operation: "connect",
      target: "https://example.test",
      level: "required",
      requiredBy: ["alpha"],
      optionalBy: ["beta"],
    },
  ]);
  assertEquals(report.optional, [{
    kind: "clipboard",
    operation: "read",
    target: "system",
    level: "optional",
    requiredBy: [],
    optionalBy: ["alpha", "beta"],
  }]);
  assert(Object.isFrozen(report));
  assert(Object.isFrozen(report.required[0]?.requiredBy));
});

Deno.test("manifests reject duplicate and ambiguous requirements", () => {
  const grant = { kind: "read", operation: "content", target: "/workspace" } as const;
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "duplicate", required: [grant, grant] }),
    RuntimePermissionManifestError,
    "unique",
  );
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "ambiguous", required: [grant], optional: [grant] }),
    RuntimePermissionManifestError,
    "required and optional",
  );
  const manifest = createRuntimePermissionManifest({ adapterId: "same", required: [grant] });
  assertThrows(
    () => createRuntimePermissionActivationReport([manifest, manifest]),
    RuntimePermissionManifestError,
    "adapter IDs",
  );
});

Deno.test("permission operations and display targets fail closed", () => {
  assertThrows(
    () =>
      createRuntimePermissionManifest({
        adapterId: "wrong.operation",
        required: [{ kind: "clipboard", operation: "spawn", target: "system" }],
      } as never),
    RuntimePermissionManifestError,
    "unsupported",
  );
  assertThrows(
    () =>
      createRuntimePermissionManifest({
        adapterId: "unsafe.target",
        required: [{ kind: "read", operation: "content", target: " /workspace" }],
      }),
    RuntimePermissionManifestError,
    "exact string",
  );
  assertThrows(
    () =>
      createRuntimePermissionManifest({
        adapterId: "unsafe.control",
        required: [{ kind: "network", operation: "connect", target: "https://safe.test\u202e.invalid" }],
      }),
    RuntimePermissionManifestError,
    "unsafe controls",
  );
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "not allowed", required: [] }),
    RuntimePermissionManifestError,
    "ASCII identifier",
  );
});

Deno.test("strict normalization rejects unknown fields versions and inherited shapes", () => {
  const manifest = createRuntimePermissionManifest({ adapterId: "strict", required: [] });
  assertThrows(
    () => normalizeRuntimePermissionManifest({ ...manifest, surprise: true }),
    RuntimePermissionManifestError,
    "unknown field",
  );
  assertThrows(
    () => normalizeRuntimePermissionManifest({ ...manifest, schemaVersion: 2 }),
    RuntimePermissionManifestError,
    "schemaVersion",
  );
  const inherited = Object.create({ inherited: true });
  Object.assign(inherited, manifest);
  assertThrows(
    () => normalizeRuntimePermissionManifest(inherited),
    RuntimePermissionManifestError,
    "plain prototype",
  );
  assertThrows(
    () => parseRuntimePermissionManifest("{not-json"),
    RuntimePermissionManifestError,
    "invalid",
  );
});

Deno.test("hostile accessors and symbols are rejected without invoking user code", () => {
  let reads = 0;
  const hostile = Object.create(null);
  Object.defineProperty(hostile, "adapterId", {
    enumerable: true,
    get() {
      reads += 1;
      return "hostile";
    },
  });
  assertThrows(
    () => createRuntimePermissionManifest(hostile),
    RuntimePermissionManifestError,
    "data propert",
  );
  assertEquals(reads, 0);

  const symbolInput = { adapterId: "symbol", required: [] };
  Object.defineProperty(symbolInput, Symbol("hidden"), { value: true, enumerable: true });
  assertThrows(
    () => createRuntimePermissionManifest(symbolInput),
    RuntimePermissionManifestError,
    "unknown field",
  );
});

Deno.test("record reflection uses one descriptor snapshot and wraps proxy failures", () => {
  const manifest = createRuntimePermissionManifest({ adapterId: "proxy.record", required: [] });
  const source = { ...manifest, surprise: true };
  let ownKeyReads = 0;
  const changingKeys = new Proxy(source, {
    ownKeys(target) {
      ownKeyReads += 1;
      const keys = Reflect.ownKeys(target);
      return ownKeyReads === 1 ? keys : keys.filter((key) => key !== "surprise");
    },
  });
  assertThrows(
    () => normalizeRuntimePermissionManifest(changingKeys),
    RuntimePermissionManifestError,
    "unknown field",
  );
  assertEquals(ownKeyReads, 1);

  const reflectionFailure = new Proxy({}, {
    ownKeys() {
      throw new Error("proxy ownKeys failed");
    },
  });
  assertThrows(
    () => normalizeRuntimePermissionManifest(reflectionFailure),
    RuntimePermissionManifestError,
    "reflection failed",
  );
});

Deno.test("requirement arrays must be dense exact data arrays", () => {
  const sparse = new Array(1);
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "sparse", required: sparse }),
    RuntimePermissionManifestError,
    "dense",
  );
  const extra = [{ kind: "read", operation: "content", target: "/workspace" } as const];
  Object.defineProperty(extra, "hidden", { value: true, enumerable: false });
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "extra", required: extra }),
    RuntimePermissionManifestError,
    "non-index",
  );
});

Deno.test("permission limits are exact and reject unsafe values", () => {
  const one = { kind: "read", operation: "content", target: "é" } as const;
  assertEquals(
    createRuntimePermissionManifest({ adapterId: "exact", required: [one] }, {
      maxRequirements: 1,
      maxTargetBytes: 2,
    }).required.length,
    1,
  );
  assertThrows(
    () =>
      createRuntimePermissionManifest({
        adapterId: "over",
        required: [one, {
          kind: "read",
          operation: "metadata",
          target: "é",
        }],
      }, { maxRequirements: 1 }),
    RuntimePermissionManifestError,
    "configured limit",
  );
  assertThrows(
    () =>
      createRuntimePermissionManifest({
        adapterId: "combined",
        required: [one],
        optional: [{ kind: "clipboard", operation: "read", target: "system" }],
      }, { maxRequirements: 1 }),
    RuntimePermissionManifestError,
    "combined",
  );
  assertThrows(
    () => createRuntimePermissionManifest({ adapterId: "bytes", required: [one] }, { maxTargetBytes: 1 }),
    RuntimePermissionManifestError,
    "maxTargetBytes",
  );
  assertThrows(
    () => resolveRuntimePermissionManifestLimits({ maxAdapters: Number.MAX_SAFE_INTEGER + 1 }),
    RuntimePermissionManifestError,
    "safe integer",
  );
});

Deno.test("activation report adapter and byte limits apply before returning partial output", () => {
  const alpha = createRuntimePermissionManifest({ adapterId: "alpha", required: [] });
  const beta = createRuntimePermissionManifest({ adapterId: "beta", required: [] });
  assertThrows(
    () => createRuntimePermissionActivationReport([alpha, beta], { maxAdapters: 1 }),
    RuntimePermissionManifestError,
    "configured limit",
  );
  assertThrows(
    () => createRuntimePermissionActivationReport([alpha], { maxReportBytes: 1 }),
    RuntimePermissionManifestError,
    "maxReportBytes",
  );
});

Deno.test("adapter reporters aggregate through a callback-free pre-activation boundary", () => {
  const permissionManifest = createRuntimePermissionManifest({
    adapterId: "production.adapter",
    required: [{ kind: "subprocess", operation: "spawn", target: "*" }],
  });
  let getterReads = 0;
  const reporter = { permissionManifest, activate: () => "activated" } satisfies RuntimePermissionReporter & {
    activate(): string;
  };
  const hostile = Object.create(null);
  Object.defineProperty(hostile, "permissionManifest", {
    enumerable: true,
    get() {
      getterReads += 1;
      return permissionManifest;
    },
  });

  const report = createRuntimePermissionActivationReportFromReporters([reporter]);
  assertEquals(report.adapterCount, 1);
  assertEquals(report.required[0]?.requiredBy, ["production.adapter"]);
  assertThrows(
    () => createRuntimePermissionActivationReportFromReporters([hostile]),
    RuntimePermissionManifestError,
    "own data property",
  );
  assertEquals(getterReads, 0);
});

Deno.test("array limits use one descriptor snapshot and cannot be bypassed by proxy length", () => {
  const manifest = createRuntimePermissionManifest({ adapterId: "proxy.adapter", required: [] });
  let lengthReads = 0;
  const reporters = new Proxy([manifest], {
    get(target, key, receiver) {
      if (key === "length") return lengthReads++ === 0 ? 0 : 1;
      return Reflect.get(target, key, receiver);
    },
  });

  assertThrows(
    () => createRuntimePermissionActivationReport(reporters, { maxAdapters: 0 }),
    RuntimePermissionManifestError,
    "configured limit",
  );
  assertEquals(lengthReads, 0);
});

Deno.test("JSON input bytes are bounded before parsing", () => {
  const manifest = createRuntimePermissionManifest({ adapterId: "json.adapter", required: [] });
  const padded = `${" ".repeat(5_000)}${serializeRuntimePermissionManifest(manifest)}`;
  assertThrows(
    () => parseRuntimePermissionManifest(padded, { maxManifestBytes: 100 }),
    RuntimePermissionManifestError,
    "maxManifestBytes",
  );
  const multibyte = `{"schemaVersion":1,"adapterId":"é","required":[],"optional":[]}`;
  const encodedLength = new TextEncoder().encode(multibyte).byteLength;
  assert(multibyte.length < encodedLength);
  assertThrows(
    () => parseRuntimePermissionManifest(multibyte, { maxManifestBytes: encodedLength - 1 }),
    RuntimePermissionManifestError,
    "maxManifestBytes",
  );
});
