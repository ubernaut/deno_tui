import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import {
  deleteFormPath,
  FORM_PATH_LIMITS,
  formatFormPath,
  type FormPath,
  FormPathError,
  type FormPathErrorCode,
  formPathFor,
  type FormPathSegment,
  formPathSegments,
  getFormPath,
  hasFormPath,
  isFormPath,
  parseFormPath,
  setFormPath,
} from "../src/app/form_paths.ts";
import { bindFormField, FormController, required } from "../src/app/forms.ts";

interface NestedValues {
  profile: {
    name: string;
    contacts: Array<{
      email: string;
      tags?: string[];
    }>;
  };
  "profile.name": string;
}

const nestedPath = formPathFor<NestedValues>();

function expectPathError(callback: () => unknown, code: FormPathErrorCode): FormPathError {
  const error = assertThrows(callback, FormPathError);
  assertEquals(error.code, code);
  assert(error.message.includes("path"));
  return error;
}

Deno.test("formPath constructs typed frozen canonical paths and parses round trips", () => {
  const email = nestedPath("profile", "contacts", 2, "email");
  const typedEmail: FormPath<NestedValues, string> = email;

  assertEquals(typedEmail.canonical, '$["profile"]["contacts"][2]["email"]');
  assertEquals(formPathSegments(email), ["profile", "contacts", 2, "email"]);
  assert(Object.isFrozen(email));
  assert(Object.isFrozen(email.segments));
  assert(isFormPath(email));
  assertEquals(parseFormPath<NestedValues, string>(email.canonical).segments, email.segments);
  assertEquals(formatFormPath(email), email.canonical);

  const mutable: FormPathSegment[] = ["profile", "name"];
  const formatted = formatFormPath(mutable);
  mutable[1] = "contacts";
  assertEquals(formatted, '$["profile"]["name"]');

  assertThrows(() => (email.segments as unknown as FormPathSegment[]).push("mutated"), TypeError);
  assertEquals(formatFormPath(parseFormPath('$["quote\\"key"][0]')), '$["quote\\"key"][0]');

  let lengthReads = 0;
  const proxiedSegments = new Proxy<FormPathSegment[]>(["profile", "name"], {
    get(target, property, receiver) {
      if (property === "length") lengthReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assertEquals(formatFormPath(proxiedSegments), '$["profile"]["name"]');
  assertEquals(lengthReads, 0);

  const hostileLength = new Proxy<FormPathSegment[]>(["profile", "name"], {
    getOwnPropertyDescriptor(target, property) {
      if (property === "length") throw new Error("length descriptor unavailable");
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  expectPathError(() => formatFormPath(hostileLength), "ACCESS_FAILED");
});

Deno.test("form path immutable helpers preserve aliases outside the changed spine and support sparse arrays", () => {
  const email = nestedPath("profile", "contacts", 2, "email");
  const missing = nestedPath("profile", "contacts", 1, "email");
  const original: NestedValues = {
    profile: { name: "Ada", contacts: [] },
    "profile.name": "literal",
  };

  const updated = setFormPath(original, email, "ada@example.test");
  assertNotStrictEquals(updated, original);
  assertNotStrictEquals(updated.profile, original.profile);
  assertNotStrictEquals(updated.profile.contacts, original.profile.contacts);
  assertEquals(original, {
    profile: { name: "Ada", contacts: [] },
    "profile.name": "literal",
  });
  assertEquals(updated.profile.contacts.length, 3);
  assertEquals(0 in updated.profile.contacts, false);
  assertEquals(1 in updated.profile.contacts, false);
  assertEquals(getFormPath(updated, email), "ada@example.test");
  assertEquals(hasFormPath(updated, email), true);
  assertEquals(hasFormPath(updated, missing), false);

  assertStrictEquals(deleteFormPath(updated, missing), updated);
  const deleted = deleteFormPath(updated, email);
  assertNotStrictEquals(deleted, updated);
  assertEquals(deleted.profile.contacts.length, 3);
  assertEquals(deleted.profile.contacts[2] as unknown, {});
  assertEquals(hasFormPath(deleted, email), false);

  const pruned = deleteFormPath(updated, email, { pruneEmpty: true });
  assertEquals(pruned as unknown, {
    profile: { name: "Ada" },
    "profile.name": "literal",
  });
});

Deno.test("form path set creates missing object and array intermediates without mutating input", () => {
  const path = nestedPath("profile", "contacts", 3, "tags", 1);
  const empty = {} as NestedValues;
  const populated = setFormPath(empty, path, "important");

  assertEquals(empty as unknown, {});
  assertEquals(populated.profile.contacts.length, 4);
  assertEquals(0 in populated.profile.contacts, false);
  assertEquals(3 in populated.profile.contacts, true);
  assertEquals(populated.profile.contacts[3]!.tags!.length, 2);
  assertEquals(0 in populated.profile.contacts[3]!.tags!, false);
  assertEquals(getFormPath(populated, path), "important");

  const withNull = { profile: null } as unknown as NestedValues;
  assertEquals(setFormPath(withNull, nestedPath("profile", "name"), "Grace").profile.name, "Grace");

  const blocked = { profile: "not-an-object" } as unknown as NestedValues;
  const error = expectPathError(
    () => setFormPath(blocked, nestedPath("profile", "name"), "Grace"),
    "NON_CONTAINER",
  );
  assertEquals(error.segmentIndex, 1);
  assertEquals(error.segment, "name");
});

Deno.test("form paths reject prototype keys malformed syntax sparse segments and configured bounds", () => {
  for (const dangerous of ["__proto__", "prototype", "constructor"]) {
    expectPathError(() => formatFormPath(["safe", dangerous]), "DANGEROUS_SEGMENT");
    expectPathError(() => parseFormPath(`$["safe"]["${dangerous}"]`), "DANGEROUS_SEGMENT");
  }
  assertEquals(({} as Record<string, unknown>).polluted, undefined);

  const sparseSegments = new Array<FormPathSegment>(2);
  sparseSegments[0] = "profile";
  expectPathError(() => formatFormPath(sparseSegments), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath([]), "INVALID_PATH");
  expectPathError(() => formatFormPath([""]), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath(["x".repeat(FORM_PATH_LIMITS.maxSegmentLength + 1)]), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath([-1]), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath([-0]), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath([Number.NaN]), "INVALID_SEGMENT");
  expectPathError(() => formatFormPath([FORM_PATH_LIMITS.maxArrayIndex + 1]), "INDEX_OUT_OF_RANGE");
  expectPathError(() => formatFormPath(new Array(FORM_PATH_LIMITS.maxDepth + 1).fill("x")), "TOO_DEEP");
  expectPathError(
    () => formatFormPath(new Array(FORM_PATH_LIMITS.maxDepth).fill("x".repeat(FORM_PATH_LIMITS.maxSegmentLength))),
    "PATH_TOO_LONG",
  );

  for (const malformed of ["", "$", "profile.name", '$["profile"].name', '$["profile"][01]', '$["profile"][-1]']) {
    expectPathError(() => parseFormPath(malformed), "INVALID_PATH");
  }
  const oversized = `$["${"x".repeat(FORM_PATH_LIMITS.maxPathLength)}"]`;
  const oversizedError = expectPathError(() => parseFormPath(oversized), "PATH_TOO_LONG");
  assert(oversizedError.message.length < 300);
});

Deno.test("form path traversal never executes accessors and reports hostile containers", () => {
  interface HostileValues {
    profile: { name: string; secret: string };
  }
  const hostilePath = formPathFor<HostileValues>();
  let reads = 0;
  const profile = { name: "Ada" } as HostileValues["profile"];
  Object.defineProperty(profile, "secret", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("getter must not execute");
    },
  });
  const values: HostileValues = { profile };

  expectPathError(() => getFormPath(values, hostilePath("profile", "secret")), "ACCESSOR_PROPERTY");
  expectPathError(
    () => setFormPath(values, hostilePath("profile", "name"), "Grace"),
    "ACCESSOR_PROPERTY",
  );
  assertEquals(reads, 0);

  const hiddenSibling = { name: "Ada" } as Record<string, unknown>;
  Object.defineProperty(hiddenSibling, "hidden", { enumerable: false, value: "must not disappear" });
  expectPathError(
    () => setFormPath({ profile: hiddenSibling }, hostilePath("profile", "name"), "Grace"),
    "UNSUPPORTED_CONTAINER",
  );
  assertEquals(hiddenSibling.name, "Ada");

  const symbolSibling = { name: "Ada" } as Record<PropertyKey, unknown>;
  symbolSibling[Symbol("sibling")] = "must not disappear";
  expectPathError(
    () => setFormPath({ profile: symbolSibling }, hostilePath("profile", "name"), "Grace"),
    "UNSUPPORTED_CONTAINER",
  );
  assertEquals(symbolSibling.name, "Ada");

  const hostileProfile = new Proxy({ name: "Ada", secret: "safe" }, {
    ownKeys() {
      throw new Error("hostile ownKeys");
    },
  });
  expectPathError(
    () => setFormPath({ profile: hostileProfile }, hostilePath("profile", "name"), "Grace"),
    "ACCESS_FAILED",
  );

  const revoked = Proxy.revocable({ name: "Ada", secret: "safe" }, {});
  revoked.revoke();
  expectPathError(
    () => setFormPath({ profile: revoked.proxy }, hostilePath("profile", "name"), "Grace"),
    "ACCESS_FAILED",
  );

  const fake = { canonical: '$["profile"]["name"]', segments: ["profile", "name"] } as unknown as FormPath<
    HostileValues,
    string
  >;
  assertEquals(isFormPath(fake), false);
  expectPathError(() => setFormPath(values, fake, "Grace"), "INVALID_PATH");
});

Deno.test("FormController registers validates resets serializes and unregisters nested fields", () => {
  const name = nestedPath("profile", "name");
  const email = nestedPath("profile", "contacts", 1, "email");
  const form = new FormController<NestedValues>();
  form.register({ name, initialValue: "Ada", label: "Name", validators: [required("Name required")] });
  form.register({ name: email, initialValue: "ada@example.test", group: "contacts", validators: [required()] });
  form.register({ name: "profile.name", initialValue: "literal dotted key" });

  const expectedContacts = new Array<{ email: string }>(2);
  expectedContacts[1] = { email: "ada@example.test" };
  assertEquals(form.snapshot().values as unknown, {
    profile: { name: "Ada", contacts: expectedContacts },
    "profile.name": "literal dotted key",
  });
  assertEquals(form.fieldNames(), [name.canonical, email.canonical, "profile.name"]);
  assertEquals(Object.keys(form.errors.peek()), [name.canonical, email.canonical, "profile.name"]);

  assertEquals(form.setValue(name, ""), true);
  form.touch(name);
  assertEquals(form.errors.peek()[name.canonical], ["Name required"]);
  assertEquals(form.touched.peek()[name.canonical], true);
  assertEquals(form.dirty.peek()[name.canonical], true);
  assertEquals(form.inspect().errorSummary[0]?.name, name.canonical);

  const patchContacts = new Array<{ email?: string }>(2);
  patchContacts[1] = { email: "grace@example.test" };
  form.setValues({
    profile: { name: "Grace", contacts: patchContacts },
    "profile.name": "still literal",
  });
  assertEquals(form.getValue(name), "Grace");
  assertEquals(form.getValue(email), "grace@example.test");
  assertEquals(form.getValue<string>("profile.name"), "still literal");

  form.reset({ profile: { name: "Reset" } });
  assertEquals(form.getValue(name), "Reset");
  assertEquals(form.getValue(email), "ada@example.test");
  assertEquals(form.getValue<string>("profile.name"), "literal dotted key");
  assertEquals(form.errors.peek()[name.canonical], []);
  assertEquals(form.touched.peek()[name.canonical], false);
  assertEquals(form.dirty.peek()[name.canonical], false);

  const snapshot = form.snapshot();
  snapshot.values.profile.name = "snapshot mutation";
  assertEquals(form.getValue(name), "Reset");
  assertEquals(JSON.parse(JSON.stringify(form.snapshot().values)).profile.name, "Reset");

  form.unregister(email);
  assertEquals(form.snapshot().values as unknown, {
    profile: { name: "Reset" },
    "profile.name": "literal dotted key",
  });
  assertEquals(email.canonical in form.errors.peek(), false);
  form.dispose();
});

Deno.test("FormController supports nested schema diagnostics and signal bindings", () => {
  const name = nestedPath("profile", "name");
  const form = new FormController<NestedValues>({
    schema: {
      fields: [{ name, initialValue: "Ada" }],
      validate: (values) => values.profile.name === "blocked" ? { [name.canonical]: "Name is blocked" } : {},
    },
  });
  const target = new Signal("");
  const dispose = bindFormField(form, name, target);

  assertEquals(target.peek(), "Ada");
  target.value = "blocked";
  assertEquals(form.getValue(name), "blocked");
  assertEquals(form.touched.peek()[name.canonical], true);
  assertEquals(form.validate(), false);
  assertEquals(form.errors.peek()[name.canonical], ["Name is blocked"]);

  form.setValue(name, "Grace");
  assertEquals(target.peek(), "Grace");
  assertEquals(form.validate(), true);
  dispose();
  form.dispose();
});

Deno.test("FormController rejects storage identity collisions while keeping dotted flat names distinct", () => {
  interface CollisionValues {
    profile: { name: string };
    "profile.name": string;
    '$["profile"]["name"]': string;
  }
  const collisionPath = formPathFor<CollisionValues>();
  const nested = collisionPath("profile", "name");
  const parent = collisionPath("profile");
  const form = new FormController<CollisionValues>();
  const disposeFirst = form.register({ name: nested, initialValue: "first" });
  const disposeSecond = form.register({
    name: collisionPath("profile", "name"),
    initialValue: "second",
  });
  disposeFirst();
  assertEquals(form.getValue(nested), "second");

  expectPathError(() => form.register({ name: parent, initialValue: { name: "parent" } }), "IDENTITY_COLLISION");
  expectPathError(
    () => form.register({ name: nested.canonical, initialValue: "canonical-looking flat key" }),
    "IDENTITY_COLLISION",
  );

  form.register({ name: "profile.name", initialValue: "literal dotted key" });
  assertEquals(form.getValue(nested), "second");
  assertEquals(form.getValue<string>("profile.name"), "literal dotted key");
  disposeSecond();
  assertEquals(form.getValue(nested), undefined);
  form.dispose();
});

Deno.test("FormController defensively clones defaults and rejects unsafe values before registration commits", () => {
  interface PayloadValues {
    payload: unknown;
    left: { label: string };
    right: { label: string };
  }
  const form = new FormController<PayloadValues>();
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const cycleError = expectPathError(() => form.register({ name: "payload", initialValue: cycle }), "CYCLE");
  assert(cycleError.path.includes("payload"));
  assertEquals(form.fieldNames(), []);

  let reads = 0;
  const hostile: Record<string, unknown> = {};
  Object.defineProperty(hostile, "secret", {
    enumerable: true,
    get() {
      reads += 1;
      return "secret";
    },
  });
  expectPathError(() => form.register({ name: "payload", initialValue: hostile }), "ACCESSOR_PROPERTY");
  assertEquals(reads, 0);
  assertEquals(form.fieldNames(), []);

  const shared = { label: "shared" };
  form.register({ name: "left", initialValue: shared });
  form.register({ name: "right", initialValue: shared });
  shared.label = "caller mutation";
  const aliased = form.snapshot();
  assertNotStrictEquals(aliased.values.left, shared);
  assertNotStrictEquals(aliased.values.left, aliased.values.right);
  assertEquals(aliased.values.left.label, "shared");
  assertEquals(aliased.values.right.label, "shared");
  aliased.values.left.label = "snapshot mutation";
  assertEquals(form.getValue<{ label: string }>("left")?.label, "shared");
  form.values.value.left.label = "direct mutation";
  form.reset();
  assertEquals(form.getValue<{ label: string }>("left")?.label, "shared");

  let deep: Record<string, unknown> = {};
  for (let index = 0; index < FORM_PATH_LIMITS.maxDepth + 2; index += 1) deep = { child: deep };
  expectPathError(() => form.register({ name: "payload", initialValue: deep }), "TOO_DEEP");
  form.dispose();
});

Deno.test("FormController keeps nested object and array writes reactive after immutable assignments", () => {
  const name = nestedPath("profile", "name");
  const email = nestedPath("profile", "contacts", 0, "email");
  const form = new FormController<NestedValues>();
  form.register({ name, initialValue: "Ada", validators: [required("Name required")] });
  form.register({ name: email, initialValue: "ada@example.test", validators: [required("Email required")] });
  const target = new Signal("initial target");
  const unbind = bindFormField(form, name, target);
  let emissions = 0;
  form.values.subscribe(() => emissions += 1);

  form.values.value.profile.name = "";
  assertEquals(target.peek(), "");
  assertEquals(form.errors.peek()[name.canonical], ["Name required"]);
  assertEquals(form.dirty.peek()[name.canonical], true);
  assert(emissions > 0);

  const heldOldContacts = form.values.value.profile.contacts;
  assertEquals(form.setValue(name, "Grace"), true);
  form.values.value.profile.name = "Katherine";
  assertEquals(target.peek(), "Katherine");
  assertEquals(form.errors.peek()[name.canonical], []);
  assertEquals(form.dirty.peek()[name.canonical], true);

  form.values.value.profile.contacts[0]!.email = "";
  assertEquals(form.getValue(email), "");
  assertEquals(form.errors.peek()[email.canonical], ["Email required"]);
  assertEquals(form.dirty.peek()[email.canonical], true);
  expectPathError(() => heldOldContacts[0]!.email = "stale@example.test", "ACCESS_FAILED");
  assertEquals(form.getValue(email), "");

  form.values.value.profile.contacts[0] = { email: "next@example.test" };
  form.values.value.profile.contacts[0]!.email = "";
  assertEquals(form.errors.peek()[email.canonical], ["Email required"]);
  assertEquals(form.dirty.peek()[email.canonical], true);

  unbind();
  form.dispose();
});

Deno.test("FormController manages root value replacement jink and subsequent nested mutations", () => {
  const name = nestedPath("profile", "name");
  const email = nestedPath("profile", "contacts", 0, "email");
  const form = new FormController<NestedValues>();
  form.register({ name, initialValue: "Ada", validators: [required("Name required")] });
  form.register({ name: email, initialValue: "ada@example.test", validators: [required("Email required")] });
  const target = new Signal("target");
  const unbind = bindFormField(form, name, target);
  let emissions = 0;
  form.values.subscribe(() => emissions += 1);

  const replacement: NestedValues = {
    profile: { name: "", contacts: [{ email: "replacement@example.test" }] },
    "profile.name": "literal",
  };
  form.values.value = replacement;
  assertEquals(emissions, 1);
  assertEquals(target.peek(), "");
  assertEquals(form.errors.peek()[name.canonical], ["Name required"]);
  assertEquals(form.dirty.peek()[name.canonical], true);
  replacement.profile.name = "caller mutation";
  assertEquals(form.getValue(name), "");

  form.values.value.profile.name = "Grace";
  assertEquals(emissions, 2);
  assertEquals(target.peek(), "Grace");
  assertEquals(form.errors.peek()[name.canonical], []);
  assertEquals(form.dirty.peek()[name.canonical], true);
  const sameRoot = form.values.value;
  form.values.value = sameRoot;
  assertEquals(emissions, 2);

  form.values.jink({
    profile: { name: "", contacts: [{ email: "jink@example.test" }] },
    "profile.name": "literal jink",
  });
  assertEquals(emissions, 2);
  assertEquals(target.peek(), "Grace");
  assertEquals(form.errors.peek()[name.canonical], ["Name required"]);
  form.values.value.profile.name = "After jink";
  assertEquals(emissions, 3);
  assertEquals(target.peek(), "After jink");
  assertThrows(() => form.values.dispose(), FormPathError);

  unbind();
  form.dispose();
});

Deno.test("FormController stages direct writes and array mutators before committing validated values", () => {
  interface UnsafeValues {
    items: Array<{ label: string }>;
    payload: unknown;
  }
  const form = new FormController<UnsafeValues>();
  form.register({ name: "items", initialValue: [{ label: "a" }, { label: "b" }, { label: "c" }] });
  form.register({
    name: "payload",
    initialValue: "safe",
    validators: [(value) => {
      if (value === "validator explosion") throw new Error("validator explosion");
      return undefined;
    }],
  });
  let emissions = 0;
  form.values.subscribe(() => emissions += 1);

  const before = form.snapshot();
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  expectPathError(() => form.values.value.payload = cycle, "CYCLE");
  assertEquals(form.snapshot(), before);
  assertEquals(emissions, 0);

  assertThrows(() => form.values.value.payload = "validator explosion", Error, "validator explosion");
  assertEquals(form.snapshot(), before);
  assertEquals(emissions, 0);

  const items = form.values.value.items;
  expectPathError(() => items.push(cycle as { label: string }), "CYCLE");
  assertEquals(form.snapshot(), before);
  assertEquals(emissions, 0);

  expectPathError(
    () => Reflect.set(items, "nonCanonical", { label: "bad" }),
    "UNSUPPORTED_CONTAINER",
  );
  expectPathError(() => Reflect.set(form.values.value, "__proto__", {}), "DANGEROUS_SEGMENT");
  expectPathError(
    () => Object.defineProperty(form.values.value, "hidden", { value: "bad" }),
    "UNSUPPORTED_CONTAINER",
  );
  expectPathError(() => Object.setPrototypeOf(form.values.value, null), "DANGEROUS_SEGMENT");
  expectPathError(() => Object.preventExtensions(form.values.value), "UNSUPPORTED_CONTAINER");
  assertEquals(Object.getPrototypeOf(form.values.value), Object.prototype);
  assertEquals(form.snapshot(), before);

  items.push({ label: "d" });
  assertEquals(emissions, 1);
  assertEquals(items.pop(), { label: "d" });
  assertEquals(emissions, 2);
  const sparseRemoved = items.splice(1, 1, { label: "x" }, { label: "y" });
  assertEquals(sparseRemoved, [{ label: "b" }]);
  assertEquals(items, [{ label: "a" }, { label: "x" }, { label: "y" }, { label: "c" }]);
  assertEquals(emissions, 3);

  assertEquals(Reflect.deleteProperty(items, "1"), true);
  assertEquals(items.length, 4);
  assertEquals(1 in items, false);
  assertEquals(emissions, 4);
  const removedHole = items.splice(1, 1);
  assertEquals(removedHole.length, 1);
  assertEquals(0 in removedHole, false);
  assertEquals(items, [{ label: "a" }, { label: "y" }, { label: "c" }]);
  assertEquals(emissions, 5);

  const staleItems = items;
  form.setValue("items", [{ label: "replacement" }]);
  expectPathError(() => staleItems.push({ label: "stale" }), "ACCESS_FAILED");
  assertEquals(form.getValue<UnsafeValues["items"]>("items"), [{ label: "replacement" }]);
  form.dispose();
});

Deno.test("FormController reflective descriptors expose managed nested object and array views", () => {
  interface DescriptorValues {
    profile: { name: string };
    items: string[];
  }
  const descriptorPath = formPathFor<DescriptorValues>();
  const name = descriptorPath("profile", "name");
  const form = new FormController<DescriptorValues>();
  form.register({ name, initialValue: "Ada", validators: [required("Name required")] });
  form.register({
    name: "items",
    initialValue: ["first"],
    validators: [(items) => items.some((item) => item === "") ? "Blank item" : undefined],
  });
  let emissions = 0;
  form.values.subscribe(() => emissions += 1);

  const profileDescriptor = Object.getOwnPropertyDescriptor(form.values.value, "profile")!;
  const managedProfile = profileDescriptor.value as DescriptorValues["profile"];
  managedProfile.name = "";
  assertEquals(form.getValue(name), "");
  assertEquals(form.errors.peek()[name.canonical], ["Name required"]);
  assertEquals(form.dirty.peek()[name.canonical], true);
  assertEquals(emissions, 1);

  const itemsDescriptor = Object.getOwnPropertyDescriptor(form.values.value, "items")!;
  const managedItems = itemsDescriptor.value as DescriptorValues["items"];
  managedItems.push("");
  assertEquals(form.getValue<DescriptorValues["items"]>("items"), ["first", ""]);
  assertEquals(form.errors.peek().items, ["Blank item"]);
  assertEquals(form.dirty.peek().items, true);
  assertEquals(emissions, 2);
  form.dispose();
});

Deno.test("FormController rejects a prepared direct mutation after validator reentry replaces its source", () => {
  interface ReentrantValues {
    value: string;
    sideEffect: string;
  }
  const form = new FormController<ReentrantValues>();
  form.register({
    name: "value",
    initialValue: "initial",
    validators: [(value) => {
      if (value === "outer") {
        form.setValue("value", "inner");
        return "outer error";
      }
      if (value === "outer direct") {
        form.values.value.sideEffect = "direct side effect";
        return "outer direct error";
      }
      if (value === "outer disabled") {
        form.setFieldDisabled("value", true);
        return "outer disabled error";
      }
      return value === "inner" ? "inner error" : undefined;
    }],
  });
  form.register({ name: "sideEffect", initialValue: "initial side effect" });
  let emissions = 0;
  form.values.subscribe(() => emissions += 1);

  expectPathError(() => form.values.value.value = "outer", "ACCESS_FAILED");
  assertEquals(form.getValue("value"), "inner");
  assertEquals(form.errors.peek().value, ["inner error"]);
  assertEquals(form.dirty.peek().value, true);
  assertEquals(emissions, 1);

  expectPathError(() => form.values.value.value = "outer direct", "ACCESS_FAILED");
  assertEquals(form.getValue("value"), "inner");
  assertEquals(form.getValue("sideEffect"), "direct side effect");
  assertEquals(form.errors.peek().value, ["inner error"]);
  assertEquals(form.dirty.peek().sideEffect, true);
  assertEquals(emissions, 2);

  expectPathError(() => form.setValue("value", "outer disabled"), "ACCESS_FAILED");
  assertEquals(form.getValue("value"), "inner");
  assertEquals(form.isFieldDisabled("value"), true);
  assertEquals(form.errors.peek().value, []);
  assertEquals(emissions, 2);
  form.dispose();
});

Deno.test("FormController disposal invalidates held proxies jink and future controller mutations", () => {
  interface DisposableValues {
    nested: { value: string };
    value: string;
  }
  const form = new FormController<DisposableValues>();
  form.register({ name: "nested", initialValue: { value: "nested initial" } });
  form.register({ name: "value", initialValue: "initial" });
  const heldNested = form.values.value.nested;
  form.dispose();

  expectPathError(() => heldNested.value = "after dispose", "ACCESS_FAILED");
  expectPathError(
    () => form.values.jink({ nested: { value: "jink" }, value: "jink" }),
    "ACCESS_FAILED",
  );
  expectPathError(() => form.register({ name: "value", initialValue: "registered" }), "ACCESS_FAILED");
  assertEquals(heldNested.value, "nested initial");
  assertEquals(form.fieldNames(), []);
  assertEquals(form.getValue("value"), undefined);
});

Deno.test("FormController clones caller-owned registration set and inspection values away from reset defaults", () => {
  interface MutableValues {
    settings: { theme: { mode: string }; tags: string[] };
  }
  const initial = { theme: { mode: "dark" }, tags: ["stable"] };
  const form = new FormController<MutableValues>();
  form.register({ name: "settings", initialValue: initial });

  initial.theme.mode = "caller mutation";
  initial.tags.push("caller tag");
  assertEquals(form.getValue<MutableValues["settings"]>("settings"), {
    theme: { mode: "dark" },
    tags: ["stable"],
  });

  const inspected = form.field("settings")!;
  (inspected.initialValue as MutableValues["settings"]).theme.mode = "inspection mutation";
  const assigned = { theme: { mode: "light" }, tags: ["assigned"] };
  assertEquals(form.setValue("settings", assigned), true);
  assigned.theme.mode = "caller changed assignment";
  assigned.tags.push("caller changed tag");
  assertEquals(form.getValue<MutableValues["settings"]>("settings"), {
    theme: { mode: "light" },
    tags: ["assigned"],
  });

  form.values.value.settings.theme.mode = "direct mutation";
  form.values.value.settings.tags.push("direct tag");
  form.reset();
  assertEquals(form.getValue<MutableValues["settings"]>("settings"), {
    theme: { mode: "dark" },
    tags: ["stable"],
  });
  form.dispose();
});

Deno.test("FormController reset is exception atomic across staged nested fields and metadata", () => {
  const name = nestedPath("profile", "name");
  const email = nestedPath("profile", "contacts", 1, "email");
  const form = new FormController<NestedValues>();
  form.register({ name, initialValue: "Ada", validators: [required("Name required")] });
  form.register({ name: email, initialValue: "ada@example.test", validators: [required("Email required")] });
  form.setValue(name, "");
  form.setValue(email, "changed@example.test");
  form.touchAll();
  const before = form.snapshot();

  let reads = 0;
  const contacts = new Array<{ email: string }>(2);
  Object.defineProperty(contacts, "1", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("getter must not execute");
    },
  });
  const patch = { profile: { name: "Reset staged first", contacts } };
  expectPathError(() => form.reset(patch), "ACCESSOR_PROPERTY");
  assertEquals(reads, 0);
  assertEquals(form.snapshot(), before);

  let reentered = false;
  const reentrantPatch = new Proxy({ profile: { name: "stale reset" } }, {
    getOwnPropertyDescriptor(target, property) {
      if (property === "profile" && !reentered) {
        reentered = true;
        form.setValue(name, "reentrant value");
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  expectPathError(() => form.reset(reentrantPatch), "ACCESS_FAILED");
  assertEquals(form.getValue(name), "reentrant value");
  assertEquals(form.dirty.peek()[name.canonical], true);
  assertEquals(form.touched.peek()[name.canonical], true);
  form.dispose();
});

Deno.test("FormController round trips emitted path names without aliasing canonical-looking flat fields", () => {
  interface IdentityValues {
    profile: { name: string };
    '$["profile"]["name"]': string;
  }
  const identityPath = formPathFor<IdentityValues>();
  const structured = identityPath("profile", "name");

  const flatForm = new FormController<IdentityValues>();
  flatForm.register({ name: structured.canonical, initialValue: "flat" });
  assertEquals(flatForm.getValue<string>(structured.canonical), "flat");
  assertEquals(flatForm.getValue(structured), undefined);
  assertEquals(flatForm.setValue(structured, "wrong identity"), false);
  flatForm.touch(structured);
  flatForm.unregister(structured);
  assertEquals(flatForm.getValue<string>(structured.canonical), "flat");
  assertEquals(flatForm.touched.peek()[structured.canonical], false);
  flatForm.dispose();

  const structuredForm = new FormController<IdentityValues>();
  structuredForm.register({ name: structured, initialValue: "structured" });
  const emitted = structuredForm.fieldNames()[0]!;
  assertEquals(emitted, structured.canonical);
  assertEquals(structuredForm.getValue(structured), "structured");
  assertEquals(structuredForm.getValue<string>(emitted), "structured");
  assertEquals(structuredForm.setValue(emitted, "round trip"), true);
  assertEquals(structuredForm.field(emitted)?.name, structured.canonical);
  structuredForm.touch(emitted);
  assertEquals(structuredForm.touched.peek()[structured.canonical], true);
  structuredForm.unregister(emitted);
  assertEquals(structuredForm.getValue(structured), undefined);
  structuredForm.dispose();
});

Deno.test("FormController metadata supports inherited-looking names without prototype lookup", () => {
  interface OddNames {
    toString: string;
    __defineGetter__: string;
  }
  const form = new FormController<OddNames>();
  form.register({ name: "toString", initialValue: "", validators: [required("toString required")] });
  form.register({
    name: "__defineGetter__",
    initialValue: "",
    validators: [required("getter required")],
  });

  assertEquals(Object.getPrototypeOf(form.errors.peek()), null);
  assertEquals(Object.hasOwn(form.errors.peek(), "toString"), true);
  assertEquals(Object.hasOwn(form.errors.peek(), "__defineGetter__"), true);
  assertEquals(form.errors.peek()["toString"], ["toString required"]);
  assertEquals(form.errors.peek()["__defineGetter__"], ["getter required"]);
  form.touch("toString");
  form.setValue("__defineGetter__", "safe");
  assertEquals(form.touched.peek()["toString"], true);
  assertEquals(form.errors.peek()["__defineGetter__"], []);

  form.reset();
  assertEquals(form.touched.peek()["toString"], false);
  assertEquals(form.dirty.peek()["__defineGetter__"], false);
  form.unregister("toString");
  assertEquals(Object.hasOwn(form.errors.peek(), "toString"), false);
  expectPathError(
    () => form.register({ name: "__proto__" as never, initialValue: "unsafe" }),
    "DANGEROUS_SEGMENT",
  );
  form.dispose();
});

Deno.test("FormController replacement registration deterministically replaces value and field metadata", () => {
  interface ReplacementValues {
    config: { mode: string };
  }
  const form = new FormController<ReplacementValues>();
  const disposeFirst = form.register({ name: "config", initialValue: { mode: "first" } });
  form.values.value.config.mode = "changed";
  form.touch("config");
  assertEquals(form.dirty.peek().config, true);
  assertEquals(form.touched.peek().config, true);

  const replacement = { mode: "" };
  const disposeSecond = form.register({
    name: "config",
    initialValue: replacement,
    validators: [(value) => value.mode === "" ? "Replacement required" : undefined],
  });
  replacement.mode = "caller mutation";
  assertEquals(form.getValue<ReplacementValues["config"]>("config"), { mode: "" });
  assertEquals(form.errors.peek().config, ["Replacement required"]);
  assertEquals(form.touched.peek().config, false);
  assertEquals(form.dirty.peek().config, false);

  disposeFirst();
  assertEquals(form.getValue<ReplacementValues["config"]>("config"), { mode: "" });
  form.setValue("config", { mode: "valid" });
  form.reset();
  assertEquals(form.getValue<ReplacementValues["config"]>("config"), { mode: "" });
  disposeSecond();
  assertEquals(form.getValue("config"), undefined);
  form.dispose();
});

Deno.test("FormController cloning enforces width node and aggregate entry bounds", () => {
  interface BoundedValues {
    payload: unknown;
  }
  const form = new FormController<BoundedValues>();
  const wide: Record<string, number> = {};
  for (let index = 0; index <= FORM_PATH_LIMITS.maxContainerEntries; index += 1) wide[`k${index}`] = index;
  expectPathError(() => form.register({ name: "payload", initialValue: wide }), "WIDTH_LIMIT");

  const tooManyNodes = Array.from({ length: FORM_PATH_LIMITS.maxCloneNodes }, () => ({}));
  expectPathError(() => form.register({ name: "payload", initialValue: tooManyNodes }), "NODE_LIMIT");

  const tooManyEntries = Array.from({ length: 9_000 }, () => ({ a: 1, b: 2, c: 3, d: 4, e: 5 }));
  expectPathError(() => form.register({ name: "payload", initialValue: tooManyEntries }), "ENTRY_LIMIT");
  assertEquals(form.fieldNames(), []);
  form.dispose();
});

Deno.test("FormPathError exposes bounded path-aware diagnostics", () => {
  const error = expectPathError(() => parseFormPath("x".repeat(20_000)), "INVALID_PATH");
  assertInstanceOf(error, Error);
  assert(error.message.length < 300);
  assertEquals(error.path.length, FORM_PATH_LIMITS.maxPathLength);
});
