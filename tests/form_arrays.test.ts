import { assert, assertEquals, assertNotStrictEquals, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  FormController,
  FormFieldArrayController,
  type FormFieldArrayItemId,
  type FormFieldArrayOptions,
} from "../src/app/forms.ts";
import { FormPathError, type FormPathErrorCode, formPathFor } from "../src/app/form_paths.ts";
import { HistoryStack } from "../src/app/history.ts";

interface Contact {
  name: string;
  channels: string[];
}

interface ContactValues {
  contacts: Contact[];
}

const contactPath = formPathFor<ContactValues>();
const contacts = contactPath("contacts");

function contact(name: string): Contact {
  return { name, channels: [`${name.toLowerCase()}@example.test`] };
}

function createContacts(
  values: Contact[] = [contact("Ada"), contact("Grace")],
  options: FormFieldArrayOptions = {},
): {
  form: FormController<ContactValues>;
  fieldArray: FormFieldArrayController<ContactValues, Contact>;
} {
  const form = new FormController<ContactValues>([{ name: contacts, initialValue: values }]);
  return { form, fieldArray: new FormFieldArrayController(form, contacts, options) };
}

function expectPathError(callback: () => unknown, code: FormPathErrorCode): FormPathError {
  const error = assertThrows(callback, FormPathError);
  assertEquals(error.code, code);
  return error;
}

Deno.test("field arrays preserve stable-ID metadata through bounded structural operations", () => {
  const allocated: Array<[number, string, string | undefined]> = [];
  const { form, fieldArray } = createContacts(undefined, {
    idProvider: (context) => {
      allocated.push([context.sequence, context.reason, context.sourceId]);
      return `contact-${context.sequence}`;
    },
  });
  const [adaId, graceId] = fieldArray.ids();
  assertEquals([adaId, graceId], ["contact-1", "contact-2"]);

  fieldArray.setItemMetadata(adaId!, {
    touched: true,
    errors: ["Email unavailable"],
    focused: true,
    fieldMetadata: { editor: { cursor: 7 }, expanded: true },
  });
  form.touch(contacts);

  const moved = fieldArray.move(adaId!, 1);
  assertEquals(moved.changed, true);
  assertEquals(moved.fromIndex, 0);
  assertEquals(moved.toIndex, 1);
  assertEquals(fieldArray.ids(), [graceId, adaId]);
  assertEquals(fieldArray.item(adaId), {
    id: adaId,
    value: contact("Ada"),
    touched: true,
    errors: ["Email unavailable"],
    focused: true,
    fieldMetadata: { editor: { cursor: 7 }, expanded: true },
  });
  assertEquals(form.touched.peek()[contacts.canonical], true);

  const duplicated = fieldArray.duplicate(adaId!);
  const duplicateId = duplicated.after.items[2]!.id;
  assertEquals(duplicateId, "contact-3");
  assertEquals(fieldArray.item(duplicateId), {
    id: duplicateId,
    value: contact("Ada"),
    touched: false,
    errors: [],
    focused: false,
    fieldMetadata: { editor: { cursor: 7 }, expanded: true },
  });
  assertEquals(allocated.at(-1), [3, "duplicate", adaId]);

  fieldArray.remove(graceId!);
  const insertedAlias = contact("Katherine");
  const inserted = fieldArray.insert(0, insertedAlias, { focused: true });
  insertedAlias.name = "caller mutation";
  insertedAlias.channels.push("caller@mutation.test");
  assertEquals(fieldArray.item(inserted.after.items[0]!.id)?.value, contact("Katherine"));
  assertEquals(fieldArray.inspect().items.filter((item) => item.focused).length, 1);
  assertEquals(form.getValue(contacts)?.map((item) => item.name), ["Katherine", "Ada", "Ada"]);
  assertEquals(Object.hasOwn(form.getValue(contacts)![0]!, "id"), false);

  const reset = fieldArray.reset();
  assertEquals(reset.changed, true);
  assertEquals(fieldArray.ids(), [adaId, graceId]);
  assertEquals(form.getValue(contacts), [contact("Ada"), contact("Grace")]);
  assertEquals(
    fieldArray.inspect().items.map(({ touched, errors, focused, fieldMetadata }) => ({
      touched,
      errors,
      focused,
      fieldMetadata,
    })),
    [
      { touched: false, errors: [], focused: false, fieldMetadata: {} },
      { touched: false, errors: [], focused: false, fieldMetadata: {} },
    ],
  );
  form.dispose();
});

Deno.test("field-array changes adapt to exactly one caller-owned history entry", async () => {
  const { form, fieldArray } = createContacts();
  const [adaId] = fieldArray.ids();
  fieldArray.setItemMetadata(adaId!, {
    touched: true,
    errors: ["Keep by ID"],
    focused: true,
    fieldMetadata: { selection: [1, 3] },
  });

  const history = new HistoryStack();
  const change = fieldArray.move(adaId!, 1);
  history.push(fieldArray.historyTransaction(change, {
    id: "contacts.move",
    label: "Move contact",
    group: "contacts",
  }));
  assertEquals(history.inspect().undoDepth, 1);
  assertEquals(history.inspect().nextUndo, {
    id: "contacts.move",
    label: "Move contact",
    group: "contacts",
  });

  assertEquals(await history.undo(), true);
  assertEquals(fieldArray.ids().map(String), [adaId, "item-2"]);
  assertEquals(fieldArray.item(adaId)?.errors, ["Keep by ID"]);
  assertEquals(await history.redo(), true);
  assertEquals(fieldArray.ids().map(String), ["item-2", adaId]);
  assertEquals(fieldArray.item(adaId)?.fieldMetadata, { selection: [1, 3] });

  const forged = { ...change };
  expectPathError(
    () => fieldArray.historyTransaction(forged),
    "ACCESS_FAILED",
  );
  form.dispose();
});

Deno.test("history restores removed values and metadata and rejects divergent state", () => {
  const { form, fieldArray } = createContacts();
  const [, graceId] = fieldArray.ids();
  fieldArray.setItemMetadata(graceId!, {
    touched: true,
    errors: ["Preserved"],
    focused: true,
    fieldMetadata: { widget: "email" },
  });
  const removed = fieldArray.remove(graceId!);
  const transaction = fieldArray.historyTransaction(removed);

  transaction.undo();
  assertEquals(fieldArray.item(graceId), {
    id: graceId,
    value: contact("Grace"),
    touched: true,
    errors: ["Preserved"],
    focused: true,
    fieldMetadata: { widget: "email" },
  });
  transaction.redo();
  assertEquals(fieldArray.item(graceId), undefined);

  transaction.undo();
  fieldArray.setValue(graceId!, contact("Diverged"));
  const before = fieldArray.inspect();
  expectPathError(() => transaction.redo(), "ACCESS_FAILED");
  assertEquals(fieldArray.inspect(), before);
  form.dispose();
});

Deno.test("field-array history tracks lineage while reset keeps allocation monotonic", () => {
  const { form, fieldArray } = createContacts([contact("Ada")]);
  const initialId = fieldArray.ids()[0]!;
  const staleChange = fieldArray.insert(1, contact("Katherine"));
  const staleTransaction = fieldArray.historyTransaction(staleChange);
  assertEquals(staleChange.after.items[1]!.id, "item-2");

  fieldArray.reset();
  const freshChange = fieldArray.insert(1, contact("Katherine"));
  const freshTransaction = fieldArray.historyTransaction(freshChange);
  assertEquals(freshChange.after.items.map((item) => item.id), [initialId, "item-3"]);
  const beforeStaleUndo = fieldArray.inspect();
  expectPathError(() => staleTransaction.undo(), "ACCESS_FAILED");
  assertEquals(fieldArray.inspect(), beforeStaleUndo);

  freshTransaction.undo();
  assertEquals(fieldArray.ids(), [initialId]);
  freshTransaction.redo();
  assertEquals(fieldArray.ids().map(String), [String(initialId), "item-3"]);
  freshTransaction.undo();
  const divergent = fieldArray.insert(1, contact("Dorothy"));
  assertEquals(divergent.after.items[1]!.id, "item-4");
  expectPathError(() => freshTransaction.redo(), "ACCESS_FAILED");
  form.dispose();
});

Deno.test("field-array lineage permits ordered stacked undo and redo", () => {
  const { form, fieldArray } = createContacts([contact("Ada")]);
  const inserted = fieldArray.insert(1, contact("Grace"));
  const insertedId = inserted.after.items[1]!.id;
  const insertTransaction = fieldArray.historyTransaction(inserted);
  const edited = fieldArray.setValue(insertedId, contact("Grace Hopper"));
  const editTransaction = fieldArray.historyTransaction(edited);

  const beforeRejectedMutation = fieldArray.inspect();
  form.setFieldReadOnly(contacts, true);
  expectPathError(() => fieldArray.setValue(insertedId, contact("Rejected")), "ACCESS_FAILED");
  form.setFieldReadOnly(contacts, false);
  assertEquals(fieldArray.inspect(), beforeRejectedMutation);
  editTransaction.undo();
  assertEquals(fieldArray.item(insertedId)?.value, contact("Grace"));
  insertTransaction.undo();
  assertEquals(fieldArray.inspect().items.map((item) => item.value), [contact("Ada")]);
  insertTransaction.redo();
  assertEquals(fieldArray.item(insertedId)?.value, contact("Grace"));
  editTransaction.redo();
  assertEquals(fieldArray.item(insertedId)?.value, contact("Grace Hopper"));
  form.dispose();
});

Deno.test("field-array inspection is deeply immutable and detached from caller aliases", () => {
  const initial = [contact("Ada")];
  const { form, fieldArray } = createContacts(initial);
  initial[0]!.name = "caller changed initial";
  initial.push(contact("Grace"));
  const id = fieldArray.ids()[0]!;
  const metadataAlias = { nested: { cursor: 3 } };
  const errorsAlias = ["One"];
  fieldArray.setItemMetadata(id, { errors: errorsAlias, fieldMetadata: metadataAlias });
  errorsAlias.push("Two");
  metadataAlias.nested.cursor = 99;

  const inspection = fieldArray.inspect();
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.items));
  assert(Object.isFrozen(inspection.items[0]));
  assert(Object.isFrozen(inspection.items[0]!.value));
  assert(Object.isFrozen(inspection.items[0]!.value.channels));
  assert(Object.isFrozen(inspection.items[0]!.errors));
  assert(Object.isFrozen(inspection.items[0]!.fieldMetadata));
  assert(Object.isFrozen(inspection.items[0]!.fieldMetadata.nested));
  assertEquals(inspection.items[0]!.value, contact("Ada"));
  assertEquals(inspection.items[0]!.errors, ["One"]);
  assertEquals(inspection.items[0]!.fieldMetadata, { nested: { cursor: 3 } });
  assertEquals(structuredClone(inspection), inspection);
  assertThrows(() => inspection.items[0]!.value.channels.push("mutation"), TypeError);
  assertThrows(
    () => ((inspection.items[0]!.fieldMetadata.nested as { cursor: number }).cursor = 10),
    TypeError,
  );

  const second = fieldArray.inspect();
  assertNotStrictEquals(second, inspection);
  assertNotStrictEquals(second.items[0]!.value, inspection.items[0]!.value);
  form.dispose();
});

Deno.test("field arrays reject symbols so every inspection remains structured-clone-safe", () => {
  const symbolic = { ...contact("Ada"), unsupported: Symbol("value") } as Contact;
  const symbolicForm = new FormController<ContactValues>([{
    name: contacts,
    initialValue: [symbolic],
  }]);
  expectPathError(
    () => new FormFieldArrayController(symbolicForm, contacts),
    "UNSUPPORTED_CONTAINER",
  );
  symbolicForm.dispose();

  const { form, fieldArray } = createContacts([contact("Ada")]);
  const id = fieldArray.ids()[0]!;
  const before = fieldArray.inspect();
  expectPathError(
    () => fieldArray.setFieldMetadata(id, { unsupported: Symbol("metadata") }),
    "UNSUPPORTED_CONTAINER",
  );
  assertEquals(fieldArray.inspect(), before);
  assertEquals(structuredClone(fieldArray.inspect()), fieldArray.inspect());
  form.dispose();
});

Deno.test("field arrays enforce item, ID, index, error, and metadata bounds atomically", () => {
  let collide = false;
  const { form, fieldArray } = createContacts([contact("Ada")], {
    maxItems: 2,
    maxErrorsPerItem: 1,
    maxFieldMetadataEntries: 1,
    idProvider: ({ sequence }) => collide ? "row-1" : `row-${sequence}`,
  });
  const id = fieldArray.ids()[0]!;

  const beforeCollision = fieldArray.inspect();
  collide = true;
  expectPathError(() => fieldArray.insert(1, contact("Grace")), "IDENTITY_COLLISION");
  assertEquals(fieldArray.inspect(), beforeCollision);
  collide = false;

  fieldArray.insert(1, contact("Grace"));
  const beforeBounds = fieldArray.inspect();
  expectPathError(() => fieldArray.insert(2, contact("Katherine")), "ENTRY_LIMIT");
  expectPathError(() => fieldArray.move(id, -1), "INDEX_OUT_OF_RANGE");
  expectPathError(() => fieldArray.move(id, 2), "INDEX_OUT_OF_RANGE");
  expectPathError(() => fieldArray.remove("missing" as FormFieldArrayItemId), "MISSING_SEGMENT");
  expectPathError(() => fieldArray.setErrors(id, ["one", "two"]), "ENTRY_LIMIT");
  expectPathError(() => fieldArray.setFieldMetadata(id, { one: 1, two: 2 }), "ENTRY_LIMIT");
  assertEquals(fieldArray.inspect(), beforeBounds);

  const oversizedIdForm = new FormController<ContactValues>([{
    name: contacts,
    initialValue: [contact("Ada")],
  }]);
  const idError = expectPathError(
    () => new FormFieldArrayController(oversizedIdForm, contacts, { idProvider: () => "x".repeat(257) }),
    "WIDTH_LIMIT",
  );
  assert(idError.message.length < 400);
  oversizedIdForm.dispose();
  form.dispose();
});

Deno.test("field arrays reject sparse/accessor data and never execute metadata accessors", () => {
  const sparse = new Array<Contact>(2);
  sparse[0] = contact("Ada");
  const sparseForm = new FormController<ContactValues>([{ name: contacts, initialValue: sparse }]);
  expectPathError(() => new FormFieldArrayController(sparseForm, contacts), "UNSUPPORTED_CONTAINER");
  sparseForm.dispose();

  const { form, fieldArray } = createContacts([contact("Ada")]);
  const id = fieldArray.ids()[0]!;
  let reads = 0;
  const metadata = {} as Record<string, unknown>;
  Object.defineProperty(metadata, "fieldMetadata", {
    enumerable: true,
    get() {
      reads += 1;
      return {};
    },
  });
  const before = fieldArray.inspect();
  expectPathError(
    () => fieldArray.setItemMetadata(id, metadata as never),
    "ACCESSOR_PROPERTY",
  );
  assertEquals(reads, 0);
  assertEquals(fieldArray.inspect(), before);

  const hostileValue = { name: "Hostile", channels: [] } as Contact;
  Object.defineProperty(hostileValue, "secret", {
    enumerable: true,
    get() {
      reads += 1;
      return "secret";
    },
  });
  expectPathError(() => fieldArray.insert(1, hostileValue), "ACCESSOR_PROPERTY");
  assertEquals(reads, 0);
  assertEquals(fieldArray.inspect(), before);
  form.dispose();
});

Deno.test("ID-provider and validator reentry fail before any field-array mutation", () => {
  const providerHolder: { fieldArray?: FormFieldArrayController<ContactValues, Contact> } = {};
  const { form, fieldArray: created } = createContacts([contact("Ada")], {
    idProvider: ({ sequence }) => {
      if (sequence === 2) providerHolder.fieldArray!.insert(0, contact("Recursive"));
      return `stable-${sequence}`;
    },
  });
  providerHolder.fieldArray = created;
  const fieldArray = created;
  const beforeProvider = fieldArray.inspect();
  expectPathError(() => fieldArray.insert(1, contact("Grace")), "ACCESS_FAILED");
  assertEquals(fieldArray.inspect(), beforeProvider);
  form.dispose();

  const disposeHolder: { fieldArray?: FormFieldArrayController<ContactValues, Contact> } = {};
  const { form: disposeForm, fieldArray: disposeGuarded } = createContacts([contact("Ada")], {
    idProvider: ({ sequence }) => {
      if (sequence === 2) disposeHolder.fieldArray!.dispose();
      return `dispose-${sequence}`;
    },
  });
  disposeHolder.fieldArray = disposeGuarded;
  const beforeDispose = disposeGuarded.inspect();
  expectPathError(() => disposeGuarded.insert(1, contact("Grace")), "ACCESS_FAILED");
  assertEquals(disposeGuarded.inspect(), beforeDispose);
  disposeForm.dispose();

  let changedHost = false;
  const hostForm = new FormController<ContactValues>([{
    name: contacts,
    initialValue: [contact("Ada")],
  }]);
  const hostGuarded = new FormFieldArrayController(hostForm, contacts, {
    idProvider: ({ sequence }) => {
      if (sequence === 2 && !changedHost) {
        changedHost = true;
        hostForm.setValue(contacts, [contact("External")]);
      }
      return `host-${sequence}`;
    },
  });
  expectPathError(() => hostGuarded.insert(1, contact("Grace")), "ACCESS_FAILED");
  assertEquals(hostForm.getValue(contacts), [contact("External")]);
  assertEquals(hostGuarded.inspect().items.map((item) => [item.id, item.value.name]), [
    ["host-1", "External"],
  ]);
  hostForm.dispose();

  let validating = false;
  const validatorHolder: { fieldArray?: FormFieldArrayController<ContactValues, Contact> } = {};
  const guardedForm = new FormController<ContactValues>([{
    name: contacts,
    initialValue: [contact("Ada")],
    validators: [() => {
      const guarded = validatorHolder.fieldArray;
      if (validating && guarded) guarded.touch(guarded.ids()[0]!);
      return undefined;
    }],
  }]);
  const guarded = new FormFieldArrayController(guardedForm, contacts);
  validatorHolder.fieldArray = guarded;
  const beforeValidation = guarded.inspect();
  validating = true;
  expectPathError(() => guarded.insert(1, contact("Grace")), "ACCESS_FAILED");
  validating = false;
  assertEquals(guarded.inspect(), beforeValidation);
  assertEquals(guardedForm.getValue(contacts), [contact("Ada")]);
  guardedForm.dispose();
});

Deno.test("synchronous form-value overwrite invalidates an in-progress field-array commit", () => {
  const { form, fieldArray } = createContacts([contact("Ada")]);
  const initialId = fieldArray.ids()[0]!;
  let overwrite = true;
  const overwriteValues = () => {
    if (!overwrite) return;
    overwrite = false;
    form.setValue(contacts, [contact("External")]);
  };
  form.values.subscribe(overwriteValues);

  expectPathError(() => fieldArray.insert(1, contact("Grace")), "ACCESS_FAILED");
  assertEquals(form.getValue(contacts), [contact("External")]);
  const reconciled = fieldArray.inspect();
  assertEquals(reconciled.items.map((item) => item.id), [initialId]);
  assertEquals(reconciled.items.map((item) => item.value), [contact("External")]);
  form.values.unsubscribe(overwriteValues);
  form.dispose();
});

Deno.test("external whole-field replacements reconcile stable IDs without exposing raw aliases", () => {
  const { form, fieldArray } = createContacts();
  const [adaId, graceId] = fieldArray.ids();
  fieldArray.setItemMetadata(adaId!, { touched: true, fieldMetadata: { retained: true } });

  const replacement = [contact("Grace"), contact("Ada"), contact("Katherine")];
  assertEquals(form.setValue(contacts, replacement), true);
  replacement[0]!.name = "caller mutation";
  const inspection = fieldArray.inspect();
  assertEquals(inspection.items.map((item) => item.id), [graceId, adaId, "item-3"]);
  assertEquals(inspection.items.map((item) => item.value.name), ["Grace", "Ada", "Katherine"]);
  assertEquals(fieldArray.item(adaId)?.touched, true);
  assertEquals(fieldArray.item(adaId)?.fieldMetadata, { retained: true });
  form.dispose();
});

Deno.test("same-cardinality external edits preserve ordered row identity and metadata", () => {
  const { form, fieldArray } = createContacts([contact("Ada"), contact("Grace")]);
  const [adaId, graceId] = fieldArray.ids();
  fieldArray.setItemMetadata(adaId!, {
    touched: true,
    errors: ["Keep through edit"],
    focused: true,
    fieldMetadata: { editor: "contact" },
  });

  assertEquals(form.setValue(contacts, [contact("Ada Lovelace"), contact("Grace")]), true);
  const edited = fieldArray.inspect();
  assertEquals(edited.items.map((item) => item.id), [adaId, graceId]);
  assertEquals(fieldArray.item(adaId!), {
    id: adaId,
    value: contact("Ada Lovelace"),
    touched: true,
    errors: ["Keep through edit"],
    focused: true,
    fieldMetadata: { editor: "contact" },
  });
  form.dispose();
});

Deno.test("external reconciliation reserves every prior identity before allocating unmatched rows", () => {
  const externalSequences: number[] = [];
  let externalAttempt = 0;
  const { form, fieldArray } = createContacts([contact("A"), contact("B")], {
    idProvider: ({ sequence, reason }) => {
      if (reason === "initial") return sequence === 1 ? "old-a" : "old-b";
      externalSequences.push(sequence);
      externalAttempt += 1;
      return externalAttempt === 1 ? "old-a" : "new-x";
    },
  });
  const oldA = fieldArray.ids()[0]!;
  fieldArray.setItemMetadata(oldA, {
    touched: true,
    errors: ["belongs to A"],
    focused: true,
    fieldMetadata: { owner: "A" },
  });
  const beforeRevision = fieldArray.inspect().revision;

  assertEquals(form.setValue(contacts, [contact("X"), contact("A"), contact("B")]), true);
  expectPathError(() => fieldArray.inspect(), "IDENTITY_COLLISION");
  assertEquals(form.getValue(contacts), [contact("X"), contact("A"), contact("B")]);

  const reconciled = fieldArray.inspect();
  assertEquals(externalSequences, [3, 3]);
  assertEquals(reconciled.revision, beforeRevision + 1);
  assertEquals(reconciled.items.map((item) => item.id), ["new-x", "old-a", "old-b"]);
  assertEquals(new Set(reconciled.items.map((item) => item.id)).size, 3);
  assertEquals(fieldArray.item(oldA), {
    id: oldA,
    value: contact("A"),
    touched: true,
    errors: ["belongs to A"],
    focused: true,
    fieldMetadata: { owner: "A" },
  });
  form.dispose();
});

Deno.test("large reverse reconciliation preserves every stable ID and its metadata", () => {
  const size = 128;
  const values = Array.from({ length: size }, (_, index) => contact(`Row-${index}`));
  const { form, fieldArray } = createContacts(values, {
    maxItems: size,
    idProvider: ({ sequence }) => `stable-${sequence}`,
  });
  const ids = fieldArray.ids();
  for (let index = 0; index < ids.length; index += 1) {
    fieldArray.setItemMetadata(ids[index]!, {
      touched: index % 2 === 0,
      errors: [`error-${index}`],
      focused: index === Math.floor(size / 2),
      fieldMetadata: { ordinal: index, editor: `editor-${index}` },
    });
  }
  const before = fieldArray.inspect();
  const beforeById = new Map(before.items.map((item) => [item.id, item]));

  assertEquals(form.setValue(contacts, [...values].reverse()), true);
  const reversed = fieldArray.inspect();
  assertEquals(reversed.items.map((item) => item.id), [...ids].reverse());
  assertEquals(new Set(reversed.items.map((item) => item.id)).size, size);
  for (const item of reversed.items) {
    const prior = beforeById.get(item.id)!;
    assertEquals({
      touched: item.touched,
      errors: item.errors,
      focused: item.focused,
      fieldMetadata: item.fieldMetadata,
    }, {
      touched: prior.touched,
      errors: prior.errors,
      focused: prior.focused,
      fieldMetadata: prior.fieldMetadata,
    });
  }
  form.dispose();
});

Deno.test("field-array no-ops remain revision-stable and disabled/stale/disposed guards are terminal", () => {
  const { form, fieldArray } = createContacts();
  const [adaId] = fieldArray.ids();
  const before = fieldArray.inspect();
  const noOp = fieldArray.move(adaId!, 0);
  assertEquals(noOp.changed, false);
  assertEquals(noOp.before, noOp.after);
  assertEquals(fieldArray.inspect().revision, before.revision);

  form.setFieldReadOnly(contacts, true);
  const readOnly = fieldArray.inspect();
  expectPathError(() => fieldArray.remove(adaId!), "ACCESS_FAILED");
  assertEquals(fieldArray.inspect(), readOnly);
  form.setFieldReadOnly(contacts, false);

  form.unregister(contacts);
  form.register({ name: contacts, initialValue: [contact("Replacement")] });
  expectPathError(() => fieldArray.inspect(), "ACCESS_FAILED");

  const replacement = new FormFieldArrayController(form, contacts);
  replacement.dispose();
  replacement.dispose();
  expectPathError(() => replacement.inspect(), "ACCESS_FAILED");
  form.dispose();

  const terminal = new FormController<ContactValues>([{
    name: contacts,
    initialValue: [contact("Ada")],
  }]);
  const terminalArray = new FormFieldArrayController(terminal, contacts);
  terminal.dispose();
  expectPathError(() => terminalArray.inspect(), "ACCESS_FAILED");
});

Deno.test("field-array controllers require an exactly registered array path", () => {
  const empty = new FormController<ContactValues>();
  expectPathError(() => new FormFieldArrayController(empty, contacts), "MISSING_SEGMENT");
  empty.dispose();

  interface WrongValues {
    contacts: string;
  }
  const wrongPath = formPathFor<WrongValues>()("contacts");
  const wrong = new FormController<WrongValues>([{ name: wrongPath, initialValue: "not-an-array" }]);
  expectPathError(
    () => new FormFieldArrayController(wrong, wrongPath as never),
    "NON_CONTAINER",
  );
  assertStrictEquals(wrong.getValue(wrongPath), "not-an-array");
  wrong.dispose();
});
