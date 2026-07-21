import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  compileRoutePattern,
  defineRouteParameterCodec,
  ROUTE_PATTERN_LIMITS,
  routeBooleanParameterCodec,
  routeIntegerParameterCodec,
  RoutePatternError,
  RoutePatternRegistry,
  routeStringParameterCodec,
} from "../src/app/route_patterns.ts";

Deno.test("compiled route patterns round-trip typed required and optional parameters", () => {
  const pattern = compileRoutePattern("/users/:id/:enabled?", {
    codecs: {
      id: routeIntegerParameterCodec,
      enabled: routeBooleanParameterCodec,
    },
  });

  const full = pattern.match("/users/42/true");
  assert(full);
  assertEquals(full.params, { id: 42, enabled: true });
  assertEquals(full.pathParams, { id: "42", enabled: "true" });
  assertEquals(full.rank, [4, 3, 2, 0]);
  assertEquals(pattern.build(full.params), "/users/42/true");
  assert(Object.isFrozen(full));
  assert(Object.isFrozen(full.params));
  assert(Object.isFrozen(full.pathParams));
  assert(Object.isFrozen(full.rank));

  const withoutOptional = pattern.match("/users/-7");
  assert(withoutOptional);
  assertEquals(withoutOptional.params, { id: -7 });
  assertEquals(withoutOptional.pathParams, { id: "-7" });
  assertEquals(pattern.build({ id: -7 }), "/users/-7");
  assertPatternError(() => pattern.match("/users/not-an-integer/true"), "codec-failure");
});

Deno.test("route patterns percent-encode decoded literals parameters and splats deterministically", () => {
  const single = compileRoutePattern("/雪 😀/:name");
  const singlePath = single.build({ name: "a/b ?#% 雪" });
  assertEquals(singlePath, "/%E9%9B%AA%20%F0%9F%98%80/a%2Fb%20%3F%23%25%20%E9%9B%AA");
  assertEquals(single.match(singlePath)?.params, { name: "a/b ?#% 雪" });

  const splat = compileRoutePattern("/files/*path");
  assertEquals(splat.build({ path: "folder one/雪.txt" }), "/files/folder%20one/%E9%9B%AA.txt");
  const match = splat.match("/files/folder%20one/%E9%9B%AA.txt");
  assert(match);
  assertEquals(match.params, { path: "folder one/雪.txt" });
  assertEquals(match.pathParams, { path: "folder one/雪.txt" });
  assertEquals(splat.build(match.params), "/files/folder%20one/%E9%9B%AA.txt");
  assertEquals(splat.match("/files/a%2Fb"), undefined);
  assertEquals(splat.match("/files/%2F"), undefined);
});

Deno.test("registry ranking prefers static required optional and splat routes in order", () => {
  const registry = new RoutePatternRegistry()
    .register("docs-splat", compileRoutePattern("/docs/*rest"))
    .register("docs-optional", compileRoutePattern("/docs/:page?"))
    .register("docs-param", compileRoutePattern("/docs/:page"))
    .register("docs-new", compileRoutePattern("/docs/new"))
    .register("docs-root", compileRoutePattern("/docs"));

  assertEquals(registry.resolve("/docs")?.routeId, "docs-root");
  assertEquals(registry.resolve("/docs/new")?.routeId, "docs-new");
  assertEquals(registry.resolve("/docs/intro")?.routeId, "docs-param");
  assertEquals(registry.resolve("/docs/guides/install")?.routeId, "docs-splat");
  assertEquals(registry.resolve("/other"), undefined);

  const optionalOnly = new RoutePatternRegistry()
    .register("optional", compileRoutePattern("/workspace/:panel?"));
  assertEquals(optionalOnly.resolve("/workspace")?.routeId, "optional");
  assertEquals(optionalOnly.resolve("/workspace/editor")?.params, { panel: "editor" });
});

Deno.test("optional parameters backtrack deterministically around static and splat segments", () => {
  const aroundStatic = compileRoutePattern("/:scope?/fixed/:tab?");
  assertEquals(aroundStatic.match("/fixed/details")?.params, { tab: "details" });
  assertEquals(aroundStatic.match("/admin/fixed/details")?.params, {
    scope: "admin",
    tab: "details",
  });

  const typedBeforeSplat = compileRoutePattern("/files/:revision?/*path", {
    codecs: { revision: routeIntegerParameterCodec },
  });
  assertEquals(typedBeforeSplat.match("/files/latest/readme")?.params, {
    path: "latest/readme",
  });
  assertEquals(typedBeforeSplat.match("/files/2/readme")?.params, {
    revision: 2,
    path: "readme",
  });
  assertEquals(typedBeforeSplat.build({ path: "latest/readme" }), "/files/latest/readme");
});

Deno.test("build rejects optional holes that would change parameter identity", () => {
  const beforeSplat = compileRoutePattern("/files/:scope?/*path");
  assertPatternError(() => beforeSplat.build({ path: "a/b" }), "invalid-parameter");
  assertEquals(beforeSplat.build({ scope: "a", path: "b" }), "/files/a/b");

  const adjacent = compileRoutePattern("/:first?/:second?");
  assertPatternError(() => adjacent.build({ second: "x" }), "invalid-parameter");
  assertEquals(adjacent.build({ first: "x" }), "/x");
});

Deno.test("registry skips a failed parameter candidate when a stronger static route matches", () => {
  const registry = new RoutePatternRegistry()
    .register(
      "numeric-user",
      compileRoutePattern("/users/:id", { codecs: { id: routeIntegerParameterCodec } }),
    )
    .register("new-user", compileRoutePattern("/users/new"));

  assertEquals(registry.resolve("/users/new")?.routeId, "new-user");
  const invalid = assertPatternError(() => registry.resolve("/users/not-a-number"), "codec-failure");
  assertEquals(invalid.path, "pathname.id");
});

Deno.test("route pattern resolutions produce immutable NAV-001 locations", () => {
  const registry = new RoutePatternRegistry().register(
    "project-task",
    compileRoutePattern("/projects/:projectId/tasks/:taskId", {
      codecs: { taskId: routeIntegerParameterCodec },
    }),
  );
  const resolution = registry.resolve("/projects/alpha%2Fbeta/tasks/9");
  assert(resolution);
  assertEquals(resolution.params, { projectId: "alpha/beta", taskId: 9 });
  assertEquals(resolution.location, {
    version: 1,
    routeId: "project-task",
    pathParams: { projectId: "alpha/beta", taskId: "9" },
    query: {},
  });
  assertEquals(structuredClone(resolution.location), resolution.location);
  assert(Object.isFrozen(resolution));
  assert(Object.isFrozen(resolution.location));
  assert(Object.isFrozen(resolution.location.pathParams));
});

Deno.test("registry contains route-location budget failures as route-pattern errors", () => {
  const pattern = compileRoutePattern("/:p0/:p1/:p2/:p3/:p4/:p5/:p6/:p7");
  const segment = "x".repeat(8_000);
  const pathname = `/${new Array(8).fill(segment).join("/")}`;
  assert(pattern.match(pathname));
  const registry = new RoutePatternRegistry().register("route-" + "r".repeat(2_000), pattern);
  const error = assertPatternError(() => registry.resolve(pathname), "limit-exceeded");
  assertEquals(error.path, "pathname");
});

Deno.test("equal-ranked route matches fail with bounded pre-dispatch diagnostics", () => {
  const firstId = `first-${"a".repeat(500)}`;
  const secondId = `second-${"b".repeat(500)}`;
  const registry = new RoutePatternRegistry()
    .register(firstId, compileRoutePattern("/teams/:id"))
    .register(secondId, compileRoutePattern("/teams/:slug"));

  const error = assertPatternError(() => registry.resolve("/teams/core"), "ambiguous-match");
  assertEquals(error.candidates.length, 2);
  assert(error.candidates.every((candidate) => Object.isFrozen(candidate)));
  assert(error.candidates.every((candidate) => candidate.routeId.length <= ROUTE_PATTERN_LIMITS.maxDiagnosticLength));
  assert(error.message.length < 600);
  assert(Object.isFrozen(error.candidates));
  assertEquals(registry.size, 2);
});

Deno.test("custom codecs are snapshotted branded and checked for deterministic round trips", () => {
  const definition = {
    decode(value: string): string {
      if (!/^[a-z]+$/i.test(value)) throw new TypeError("letters only");
      return value.toLowerCase();
    },
    encode(value: string): string {
      if (!/^[a-z]+$/.test(value)) throw new TypeError("canonical lower case only");
      return value;
    },
  };
  const codec = defineRouteParameterCodec(definition);
  const codecs = { word: codec };
  const pattern = compileRoutePattern("/words/:word", { codecs });

  definition.decode = () => "mutated";
  codecs.word = routeStringParameterCodec;
  assertEquals(pattern.match("/words/HELLO")?.params, { word: "hello" });
  assertEquals(pattern.build({ word: "hello" }), "/words/hello");

  const proxiedCodec = new Proxy(codec, {});
  assertPatternError(
    () => compileRoutePattern("/:word", { codecs: { word: proxiedCodec } }),
    "invalid-codec",
  );
  assertPatternError(
    () =>
      compileRoutePattern("/:word", {
        codecs: {
          word: {
            decode: (value: string) => value,
            encode: (value: string) => value,
          },
        },
      }),
    "invalid-codec",
  );

  let toggle = false;
  const unstable = defineRouteParameterCodec<string>({
    decode: (value) => value,
    encode(value) {
      toggle = !toggle;
      return `${value}${toggle ? "" : "!"}`;
    },
  });
  const unstablePattern = compileRoutePattern("/:value", { codecs: { value: unstable } });
  assertPatternError(() => unstablePattern.match("/x"), "codec-failure");
});

Deno.test("codec exceptions and non-primitive results are contained in structured errors", () => {
  const throwing = defineRouteParameterCodec<string>({
    decode() {
      throw new Error("sensitive implementation detail");
    },
    encode(value) {
      return value;
    },
  });
  const invalidResult = defineRouteParameterCodec(
    {
      decode: () => ({ unsafe: true }),
      encode: () => "unsafe",
    } as unknown as {
      decode(value: string): string;
      encode(value: string): string;
    },
  );
  const spoofedPatternError = defineRouteParameterCodec<string>({
    decode() {
      throw new RoutePatternError("ambiguous-match", "spoofed", "must not escape a codec callback");
    },
    encode(value) {
      return value;
    },
  });

  const throwingPattern = compileRoutePattern("/:value", { codecs: { value: throwing } });
  const throwError = assertPatternError(() => throwingPattern.match("/x"), "codec-failure");
  assertEquals(throwError.message.includes("sensitive implementation detail"), false);

  const invalidPattern = compileRoutePattern("/:value", { codecs: { value: invalidResult } });
  assertPatternError(() => invalidPattern.match("/x"), "codec-failure");

  const spoofedPattern = compileRoutePattern("/:value", { codecs: { value: spoofedPatternError } });
  assertPatternError(() => spoofedPattern.match("/x"), "codec-failure");
});

Deno.test("patterns reject malformed syntax duplicate names unsafe keys and unmatched codecs", () => {
  assertPatternError(() => compileRoutePattern("users/:id"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/users/"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/users//details"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/:id/:id"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/:__proto__"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/:constructor"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/*rest/more"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/./file"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/files?query"), "invalid-pattern");
  assertPatternError(() => compileRoutePattern("/files#fragment"), "invalid-pattern");
  assertPatternError(
    () => compileRoutePattern("/:id", { codecs: { other: routeStringParameterCodec } }),
    "invalid-codec",
  );
});

Deno.test("path matching rejects malformed percent encoding and non-path envelopes", () => {
  const pattern = compileRoutePattern("/:value");
  assertPatternError(() => pattern.match("/%"), "invalid-encoding");
  assertPatternError(() => pattern.match("/%FF"), "invalid-encoding");
  assertPatternError(() => pattern.match("missing-slash"), "invalid-path");
  assertPatternError(() => pattern.match("/value/"), "invalid-path");
  assertPatternError(() => pattern.match("/value?query=1"), "invalid-path");
  assertPatternError(() => pattern.match("/value#fragment"), "invalid-path");
  assertPatternError(() => pattern.match("/.."), "invalid-path");
  assertPatternError(() => pattern.match("/%2e%2e"), "invalid-path");
  assertPatternError(() => pattern.match(`/bad\ud800`), "invalid-path");
  assertEquals(pattern.match("/one/two"), undefined);
});

Deno.test("build rejects accessors proxies unknown keys missing values and hostile coercion", () => {
  const pattern = compileRoutePattern("/users/:id", { codecs: { id: routeIntegerParameterCodec } });
  let getterCalls = 0;
  let coercionCalls = 0;
  const accessor = Object.defineProperty({}, "id", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 1;
    },
  });
  const hostileValue = Object.defineProperty({}, "toString", {
    get() {
      coercionCalls += 1;
      return () => "1";
    },
  });

  assertPatternError(() => pattern.build(accessor as { id: number }), "invalid-parameter");
  assertPatternError(() => pattern.build({ id: hostileValue } as unknown as { id: number }), "codec-failure");
  assertEquals(getterCalls, 0);
  assertEquals(coercionCalls, 0);
  assertPatternError(() => pattern.build({} as { id: number }), "invalid-parameter");

  const stringPattern = compileRoutePattern("/users/:id");
  assertPatternError(() => stringPattern.build({ id: "." }), "invalid-parameter");
  assertPatternError(() => stringPattern.build({ id: ".." }), "invalid-parameter");
  const splatPattern = compileRoutePattern("/files/*path");
  assertPatternError(() => splatPattern.build({ path: "safe/../escape" }), "invalid-parameter");
  assertPatternError(
    () => pattern.build({ id: 1, extra: "unsafe" } as unknown as { id: number }),
    "invalid-parameter",
  );

  const revoked = Proxy.revocable({ id: 1 }, {});
  revoked.revoke();
  assertPatternError(() => pattern.build(revoked.proxy), "invalid-parameter");
});

Deno.test("codec and option accessors are rejected without invoking getters", () => {
  let getterCalls = 0;
  const accessorDefinition = Object.defineProperty({}, "decode", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return (value: string) => value;
    },
  });
  Object.defineProperty(accessorDefinition, "encode", {
    enumerable: true,
    value: (value: string) => value,
  });
  assertPatternError(
    () => defineRouteParameterCodec(accessorDefinition as RouteParameterCodecShape),
    "invalid-parameter",
  );

  const accessorCodecs = Object.defineProperty({}, "id", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return routeIntegerParameterCodec;
    },
  });
  assertPatternError(
    () => compileRoutePattern("/:id", { codecs: accessorCodecs as { id: typeof routeIntegerParameterCodec } }),
    "invalid-parameter",
  );
  assertEquals(getterCalls, 0);
});

Deno.test("registry snapshots trusted patterns and detects reentrant stale evaluation", () => {
  const registry = new RoutePatternRegistry();
  const stable = compileRoutePattern("/stable/:id");
  registry.register("stable", stable);
  assertPatternError(() => registry.register("proxy", new Proxy(stable, {})), "invalid-pattern");
  assertEquals(registry.pattern("stable"), stable);
  assertEquals(registry.unregister("missing"), false);

  const holder: { registry?: RoutePatternRegistry } = {};
  const reentrantCodec = defineRouteParameterCodec<string>({
    decode(value) {
      holder.registry!.unregister("victim");
      return value;
    },
    encode(value) {
      return value;
    },
  });
  const reentrantRegistry = new RoutePatternRegistry().register(
    "victim",
    compileRoutePattern("/reentrant/:id", { codecs: { id: reentrantCodec } }),
  );
  holder.registry = reentrantRegistry;
  assertPatternError(() => reentrantRegistry.resolve("/reentrant/one"), "stale-registry");
  assertEquals(reentrantRegistry.size, 0);

  let encodeCalls = 0;
  const buildHolder: { registry?: RoutePatternRegistry } = {};
  const buildCodec = defineRouteParameterCodec<string>({
    decode: (value) => value,
    encode(value) {
      encodeCalls += 1;
      if (encodeCalls === 3) {
        buildHolder.registry!.register("late", compileRoutePattern("/late"));
      }
      return value;
    },
  });
  const buildRegistry = new RoutePatternRegistry().register(
    "build-reentrant",
    compileRoutePattern("/:value", { codecs: { value: buildCodec } }),
  );
  buildHolder.registry = buildRegistry;
  assertPatternError(() => buildRegistry.build("build-reentrant", { value: "x" }), "stale-registry");
  assertEquals(buildRegistry.size, 2);
});

Deno.test("inspection snapshots are frozen clone-safe and detached from registry changes", () => {
  const compiled = compileRoutePattern("/files/:scope?/*path");
  const first = compiled.inspect();
  const second = compiled.inspect();
  assertEquals(first, {
    source: "/files/:scope?/*path",
    parameterNames: ["scope", "path"],
    segmentKinds: ["static", "optional", "splat"],
    rank: [4, 2, 1],
  });
  assert(first !== second);
  assert(first.parameterNames !== second.parameterNames);
  assert(Object.isFrozen(first));
  assert(Object.isFrozen(first.parameterNames));
  assertEquals(structuredClone(first), first);

  const registry = new RoutePatternRegistry().register("files", compiled);
  const inspection = registry.inspect();
  registry.clear();
  assertEquals(inspection.size, 1);
  assertEquals(inspection.entries[0]?.routeId, "files");
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.entries));
  assert(Object.isFrozen(inspection.entries[0]));
  assertEquals(structuredClone(inspection), inspection);
});

Deno.test("route-pattern limits bound segments parameters candidates paths and diagnostics", () => {
  const tooManySegments = `/${Array.from({ length: ROUTE_PATTERN_LIMITS.maxSegments + 1 }, () => "x").join("/")}`;
  assertPatternError(() => compileRoutePattern(tooManySegments), "limit-exceeded");

  const tooManyParameters = `/${
    Array.from({ length: ROUTE_PATTERN_LIMITS.maxParameters + 1 }, (_, index) => `:p${index}`).join("/")
  }`;
  assertPatternError(() => compileRoutePattern(tooManyParameters), "limit-exceeded");
  assertPatternError(
    () => compileRoutePattern(`/${"x".repeat(ROUTE_PATTERN_LIMITS.maxPatternLength)}`),
    "limit-exceeded",
  );
  assertPatternError(
    () => compileRoutePattern("/:value").match(`/${"x".repeat(ROUTE_PATTERN_LIMITS.maxPathLength)}`),
    "limit-exceeded",
  );

  const registry = new RoutePatternRegistry();
  const pattern = compileRoutePattern("/fixed");
  for (let index = 0; index < ROUTE_PATTERN_LIMITS.maxCandidates; index += 1) {
    registry.register(`route-${index}`, pattern);
  }
  assertPatternError(() => registry.register("overflow", pattern), "limit-exceeded");
  assertEquals(registry.size, ROUTE_PATTERN_LIMITS.maxCandidates);
});

Deno.test("registry route lifecycle and build failures are explicit and atomic", () => {
  const registry = new RoutePatternRegistry().register("user", compileRoutePattern("/users/:id"));
  assertEquals(registry.build("user", { id: "a/b" }), "/users/a%2Fb");
  assertPatternError(() => registry.register("user", compileRoutePattern("/replacement")), "duplicate-route");
  assertPatternError(() => registry.build("missing", {}), "unknown-route");
  assertEquals(registry.unregister("user"), true);
  assertEquals(registry.resolve("/users/one"), undefined);
  assertEquals(registry.size, 0);
});

interface RouteParameterCodecShape {
  decode(value: string): string;
  encode(value: string): string;
}

function assertPatternError(fn: () => unknown, code: RoutePatternError["code"]): RoutePatternError {
  const error = assertThrows(fn, RoutePatternError);
  assertEquals(error.code, code);
  assert(error.path.length <= ROUTE_PATTERN_LIMITS.maxDiagnosticLength);
  return error;
}
