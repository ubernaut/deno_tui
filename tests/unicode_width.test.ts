import { assert, assertEquals, assertFalse, assertNotStrictEquals, assertThrows } from "./deps.ts";
import {
  CJK_WIDE_WIDTH_PROFILE,
  DEFAULT_TERMINAL_WIDTH_PROFILE_REGISTRY,
  TERMINAL_WIDTH_PROFILE_LIMITS,
  terminalCodePointWidth,
  terminalTextWidth,
  TerminalWidthError,
  TerminalWidthProfileRegistry,
  UNICODE_NARROW_WIDTH_PROFILE,
  UnicodeTerminalWidthProfile,
  VISIBLE_COMBINING_WIDTH_PROFILE,
} from "../src/unicode/width.ts";
import {
  CJK_WIDE_WIDTH_PROFILE as TERMINAL_CJK_WIDTH_PROFILE,
  terminalCodePointWidth as terminalHostCodePointWidth,
  TerminalWidthProfileRegistry as TerminalHostWidthProfileRegistry,
  UNICODE_NARROW_WIDTH_PROFILE as TERMINAL_NARROW_WIDTH_PROFILE,
} from "../mod.terminal.ts";
import {
  CJK_WIDE_WIDTH_PROFILE as WEB_CJK_WIDTH_PROFILE,
  terminalCodePointWidth as webHostCodePointWidth,
  TerminalWidthProfileRegistry as WebHostWidthProfileRegistry,
  UNICODE_NARROW_WIDTH_PROFILE as WEB_NARROW_WIDTH_PROFILE,
} from "../mod.web.ts";

const CUSTOM_POLICY = Object.freeze({
  ambiguous: 2 as const,
  combining: 1 as const,
  privateUse: 1 as const,
  unassigned: 0 as const,
});

Deno.test("Unicode 17 terminal profiles classify every UAX #11 and tailoring category", () => {
  const fixtures = [
    [0x0041, 1, 1, "narrow", "Na", true],
    [0x00a1, 1, 2, "ambiguous", "A", true],
    [0x3000, 2, 2, "fullwidth", "F", true],
    [0x754c, 2, 2, "wide", "W", true],
    [0xff66, 1, 1, "halfwidth", "H", true],
    [0x00a9, 1, 1, "neutral", "N", true],
    [0x0301, 0, 0, "combining", "A", true],
    [0x09be, 1, 1, "neutral", "N", true],
    [0x1161, 0, 0, "combining", "N", true],
    [0x11a8, 0, 0, "combining", "N", true],
    [0x200d, 0, 0, "zero-width-control", "N", true],
    [0x200c, 0, 0, "zero-width-control", "N", true],
    [0x2065, 1, 2, "unassigned", "N", false],
    [0x302e, 2, 2, "wide", "W", true],
    [0xe000, 1, 2, "private-use", "A", true],
    [0xfdd0, 1, 2, "unassigned", "N", false],
    [0xfe0f, 0, 0, "combining", "A", true],
    [0xff9e, 1, 1, "halfwidth", "H", true],
    [0x0378, 1, 2, "unassigned", "N", false],
    [0x2fa1e, 1, 2, "unassigned", "W", false],
    [0x10ffff, 1, 2, "unassigned", "N", false],
    [0x1f3fb, 2, 2, "wide", "W", true],
    [0x1f600, 2, 2, "wide", "W", true],
  ] as const;

  for (const [codePoint, narrow, cjk, category, eastAsianWidth, assigned] of fixtures) {
    assertEquals(UNICODE_NARROW_WIDTH_PROFILE.measureCodePoint(codePoint), {
      codePoint,
      width: narrow,
      category,
      eastAsianWidth,
      assigned,
    });
    assertEquals(CJK_WIDE_WIDTH_PROFILE.codePointWidth(codePoint), cjk);
  }
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.codePointWidth(0x0301), 1);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.codePointWidth(0x1161), 1);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.codePointWidth(0x11a8), 1);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.codePointWidth(0xfe0f), 1);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.codePointWidth(0x200d), 0);
  assertEquals(UNICODE_NARROW_WIDTH_PROFILE.textWidth("\u1100\u1161\u11a8"), 2);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.textWidth("\u1100\u1161\u11a8"), 4);
});

Deno.test("text measurement is scalar-aware, bounded, categorized, and immutable", () => {
  const text = "A¡界e\u0301";
  const measured = UNICODE_NARROW_WIDTH_PROFILE.measureText(text);
  assertEquals(measured, {
    utf16Length: 5,
    codePointCount: 5,
    cells: 5,
    categoryCounts: {
      "zero-width-control": 0,
      combining: 1,
      "private-use": 0,
      unassigned: 0,
      ambiguous: 1,
      fullwidth: 0,
      wide: 1,
      halfwidth: 0,
      narrow: 2,
      neutral: 0,
    },
  });
  assertEquals(CJK_WIDE_WIDTH_PROFILE.textWidth(text), 6);
  assertEquals(VISIBLE_COMBINING_WIDTH_PROFILE.textWidth(text), 6);
  assert(Object.isFrozen(measured));
  assert(Object.isFrozen(measured.categoryCounts));
  assertThrows(() => (measured.categoryCounts as Record<string, number>).wide = 99, TypeError);
  assertThrows(
    () => UNICODE_NARROW_WIDTH_PROFILE.textWidth("x".repeat(TERMINAL_WIDTH_PROFILE_LIMITS.maxTextUtf16Length + 1)),
    TerminalWidthError,
    "limit",
  );
  assertThrows(() => UNICODE_NARROW_WIDTH_PROFILE.textWidth("\ud800"), TerminalWidthError, "scalar");
  assertThrows(() => UNICODE_NARROW_WIDTH_PROFILE.textWidth(new String("x") as unknown as string), TerminalWidthError);
});

Deno.test("profile definitions are snapshotted and inspection is clone-safe", () => {
  const policy: { ambiguous: 1 | 2; combining: 0 | 1; privateUse: 1 | 2; unassigned: 0 | 1 | 2 } = {
    ambiguous: 2,
    combining: 1,
    privateUse: 1,
    unassigned: 0,
  };
  const definition = { name: "custom", description: "Caller-owned input", policy };
  const profile = new UnicodeTerminalWidthProfile(definition);
  policy.ambiguous = 1;
  definition.description = "mutated";

  assertEquals(profile.name, "custom");
  assertEquals(profile.policy, CUSTOM_POLICY);
  assertNotStrictEquals(profile.policy, profile.policy);
  assertEquals(profile.codePointWidth(0x00a1), 2);
  assertEquals(profile.codePointWidth(0x0301), 1);
  assertEquals(profile.codePointWidth(0x0378), 0);
  const inspection = profile.inspect();
  assertEquals(inspection.description, "Caller-owned input");
  assertEquals(inspection.unicodeVersion, "17.0.0");
  assertEquals(inspection.dataPackFingerprint, "4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2");
  assertEquals(inspection.widthDataFingerprint, "f9935ff076aa5994700815d5b6117c7bc9fda5991c8d6dc4b8f78e742b4259f3");
  assertEquals(inspection.assignedSource.name, "derived-general-category");
  assertEquals(inspection.assignedSource.sha256, "d62e5bab70ca74f099343f71224fa051cb1fdd61a1ab45c0488c44cfc0b6102e");
  assert(Object.isFrozen(profile));
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.policy));
  assert(Object.isFrozen(inspection.assignedSource));
  assertEquals(structuredClone(inspection), inspection);
});

Deno.test("terminal and browser public entrypoints share a corpus but select profiles independently", () => {
  const terminal = new TerminalHostWidthProfileRegistry(
    [TERMINAL_NARROW_WIDTH_PROFILE, TERMINAL_CJK_WIDTH_PROFILE],
    { defaultProfile: "unicode-narrow" },
  );
  const browser = new WebHostWidthProfileRegistry(
    [WEB_NARROW_WIDTH_PROFILE, WEB_CJK_WIDTH_PROFILE],
    { defaultProfile: "cjk-wide" },
  );
  const corpus = [0x0041, 0x00a1, 0x0301, 0x1161, 0x302e, 0x1f600] as const;
  assertEquals(
    corpus.map((codePoint) => terminalHostCodePointWidth(codePoint, TERMINAL_NARROW_WIDTH_PROFILE)),
    corpus.map((codePoint) => webHostCodePointWidth(codePoint, WEB_NARROW_WIDTH_PROFILE)),
  );
  assertEquals(terminal.select().codePointWidth(0x00a1), 1);
  assertEquals(browser.select().codePointWidth(0x00a1), 2);
  assertEquals(terminal.defaultProfile, "unicode-narrow");
  assertEquals(browser.defaultProfile, "cjk-wide");
  assertEquals(terminal.names, ["cjk-wide", "unicode-narrow"]);
  assertNotStrictEquals(terminal.names, terminal.names);
  assertEquals(DEFAULT_TERMINAL_WIDTH_PROFILE_REGISTRY.defaultProfile, "unicode-narrow");
  const inspection = browser.inspect();
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.names));
  assert(Object.isFrozen(inspection.profiles));
  assertEquals(structuredClone(inspection), inspection);
});

Deno.test("registries add and replace immutable profiles with explicit default selection", () => {
  const base = new TerminalWidthProfileRegistry([UNICODE_NARROW_WIDTH_PROFILE]);
  const added = base.withProfile({ name: "custom", policy: CUSTOM_POLICY }, { makeDefault: true });
  assertEquals(base.names, ["unicode-narrow"]);
  assertEquals(added.names, ["custom", "unicode-narrow"]);
  assertEquals(added.defaultProfile, "custom");
  assertEquals(added.select().codePointWidth(0x0378), 0);
  assertThrows(
    () => added.withProfile({ name: "custom", policy: CUSTOM_POLICY }),
    TerminalWidthError,
    "already registered",
  );
  const replaced = added.withProfile(
    {
      name: "custom",
      policy: { ambiguous: 1, combining: 0, privateUse: 2, unassigned: 2 },
    },
    { replace: true },
  );
  assertEquals(replaced.select().codePointWidth(0x0378), 2);
});

Deno.test("profile boundaries reject accessors, sparse arrays, proxies, and unknown properties", () => {
  let getterCalls = 0;
  const accessorDefinition = Object.defineProperty({}, "name", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "hostile";
    },
  });
  assertThrows(
    () => new UnicodeTerminalWidthProfile(accessorDefinition as never),
    TerminalWidthError,
    "data property",
  );
  assertEquals(getterCalls, 0);

  assertThrows(
    () =>
      new UnicodeTerminalWidthProfile({
        name: "unknown",
        policy: CUSTOM_POLICY,
        extra: true,
      } as never),
    TerminalWidthError,
    "unknown",
  );
  assertThrows(() => new TerminalWidthProfileRegistry(new Array(1)), TerminalWidthError, "sparse");
  const { proxy, revoke } = Proxy.revocable({ name: "revoked", policy: CUSTOM_POLICY }, {});
  revoke();
  const revokedError = assertThrows(
    () => new UnicodeTerminalWidthProfile(proxy as never),
    TerminalWidthError,
  );
  assertEquals(revokedError.code, "invalid-profile");

  let indexedDescriptorReads = 0;
  const oversizedProfiles = new Proxy(
    new Array(TERMINAL_WIDTH_PROFILE_LIMITS.maxProfiles + 1).fill(UNICODE_NARROW_WIDTH_PROFILE),
    {
      getOwnPropertyDescriptor(target, key) {
        if (key !== "length") indexedDescriptorReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  const oversizedError = assertThrows(
    () => new TerminalWidthProfileRegistry(oversizedProfiles),
    TerminalWidthError,
  );
  assertEquals(oversizedError.code, "limit-exceeded");
  assertEquals(indexedDescriptorReads, 0);

  class DerivedProfile extends UnicodeTerminalWidthProfile {}
  assertThrows(() => new DerivedProfile({ name: "derived", policy: CUSTOM_POLICY }), TerminalWidthError, "subclassed");
});

Deno.test("invalid profiles, registry operations, and scalar values return typed bounded failures", () => {
  const invalidDefinitions: unknown[] = [
    null,
    {},
    { name: "Uppercase", policy: CUSTOM_POLICY },
    { name: "x".repeat(65), policy: CUSTOM_POLICY },
    { name: "custom", description: "x".repeat(257), policy: CUSTOM_POLICY },
    { name: "custom", policy: { ...CUSTOM_POLICY, ambiguous: 0 } },
    { name: "custom", policy: { ...CUSTOM_POLICY, combining: 2 } },
    { name: "custom", policy: { ...CUSTOM_POLICY, privateUse: 0 } },
    { name: "custom", policy: { ...CUSTOM_POLICY, unassigned: 3 } },
  ];
  for (const definition of invalidDefinitions) {
    assertThrows(() => new UnicodeTerminalWidthProfile(definition as never), TerminalWidthError);
  }
  const malformedNameError = assertThrows(
    () => new UnicodeTerminalWidthProfile({ name: "Uppercase", policy: CUSTOM_POLICY }),
    TerminalWidthError,
  );
  assertEquals(malformedNameError.code, "invalid-profile");

  assertThrows(() => new TerminalWidthProfileRegistry([]), TerminalWidthError, "at least one");
  assertThrows(
    () => new TerminalWidthProfileRegistry([UNICODE_NARROW_WIDTH_PROFILE, UNICODE_NARROW_WIDTH_PROFILE]),
    TerminalWidthError,
    "unique",
  );
  assertThrows(
    () => new TerminalWidthProfileRegistry([UNICODE_NARROW_WIDTH_PROFILE], { defaultProfile: "missing" }),
    TerminalWidthError,
    "not registered",
  );
  assertThrows(() => DEFAULT_TERMINAL_WIDTH_PROFILE_REGISTRY.select("missing"), TerminalWidthError, "not registered");
  assertThrows(
    () =>
      DEFAULT_TERMINAL_WIDTH_PROFILE_REGISTRY.withProfile({ name: "x", policy: CUSTOM_POLICY }, {
        replace: 1 as never,
      }),
    TerminalWidthError,
    "boolean",
  );

  for (const value of [-1, 0x110000, 0xd800, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const error = assertThrows(
      () => UNICODE_NARROW_WIDTH_PROFILE.codePointWidth(value),
      TerminalWidthError,
      "scalar",
    );
    assertEquals(error.code, "invalid-code-point");
    assert(error.message.length <= TERMINAL_WIDTH_PROFILE_LIMITS.maxDiagnosticLength * 2 + 2);
  }
});

Deno.test("convenience helpers require genuine unproxied profiles", () => {
  assertEquals(terminalCodePointWidth(0x1f600), 2);
  assertEquals(terminalTextWidth("A界"), 3);
  assertThrows(() => terminalCodePointWidth(0x41, {} as never), TerminalWidthError, "profile");
  assertThrows(() => terminalTextWidth("A", new Proxy(UNICODE_NARROW_WIDTH_PROFILE, {}) as never), TerminalWidthError);
  assertFalse(Object.isExtensible(UNICODE_NARROW_WIDTH_PROFILE));
});
