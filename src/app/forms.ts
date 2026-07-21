// Copyright 2023 Im-Beast. MIT license.
import { batchSignalUpdates, Signal } from "../signals/mod.ts";
import { DisposableStack } from "./disposables.ts";

import {
  cloneFormData,
  deleteFormPath,
  FORM_PATH_LIMITS,
  FormPathError,
  getFormPath,
  isFormPath,
  normalizeFieldReference,
  ownDataEntries,
  pathsOverlap,
  readFormPath,
  setFormPath,
} from "./form_paths.ts";
import type { FormFieldReference, FormFieldValue, FormPath, FormPathName, FormValuesPatch } from "./form_paths.ts";

/** Public form values base shape. */
export type FormValues = object;
/** Public name emitted for a registered form field. */
export type FieldName<TValues extends FormValues> = Extract<keyof TValues, string> | FormPathName<TValues>;
/** Public type alias for a field Validator. */
export type FieldValidator<TValue = unknown, TValues extends FormValues = FormValues> = (
  value: TValue,
  values: TValues,
) => string | undefined;
/** Public type alias for a form Field State. */
export type FormFieldState = boolean | (() => boolean);

/** Public type alias for form Schema Validation Errors. */
export type FormSchemaValidationErrors<TValues extends FormValues = FormValues> = Partial<
  Record<FieldName<TValues> | string, readonly string[] | string | undefined>
>;

/** Public interface describing a form Field. */
export interface FormField<TValue = unknown, TValues extends FormValues = FormValues> {
  name: FormFieldReference<TValues, TValue>;
  initialValue: TValue;
  label?: string;
  group?: string;
  disabled?: FormFieldState;
  readOnly?: FormFieldState;
  validators?: readonly FieldValidator<TValue, TValues>[];
}

/** Adapter interface for deriving fields and whole-form validation from a schema library. */
export interface FormSchemaAdapter<TValues extends FormValues = FormValues> {
  fields: readonly FormField<unknown, TValues>[] | (() => readonly FormField<unknown, TValues>[]);
  validate?: (values: TValues) => FormSchemaValidationErrors<TValues>;
}

/** Options for constructing a form controller. */
export interface FormControllerOptions<TValues extends FormValues = FormValues> {
  fields?: readonly FormField<unknown, TValues>[];
  schema?: FormSchemaAdapter<TValues>;
}

/** Options for configuring form Field Binding. */
export interface FormFieldBindingOptions<TField, TTarget = TField> {
  parse?: (value: TTarget) => TField;
  format?: (value: TField) => TTarget;
  initialSync?: "form" | "target";
  touchOnChange?: boolean;
  validateOnBind?: boolean;
}

/** Public interface describing a form Snapshot. */
export interface FormSnapshot<TValues extends FormValues = FormValues> {
  values: TValues;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  valid: boolean;
}

/** Serializable inspection snapshot for form Field. */
export interface FormFieldInspection<TValues extends FormValues = FormValues> {
  name: FieldName<TValues>;
  touched: boolean;
  dirty: boolean;
  label?: string;
  group?: string;
  disabled: boolean;
  readOnly: boolean;
  errors: string[];
  valid: boolean;
}

/** Error summary row for rendering validation summaries outside individual fields. */
export interface FormErrorSummaryItem<TValues extends FormValues = FormValues> {
  name: FieldName<TValues>;
  label?: string;
  group?: string;
  errors: string[];
}

/** Group-level form inspection for renderer-neutral sections and fieldsets. */
export interface FormGroupInspection<TValues extends FormValues = FormValues> {
  id: string;
  label: string;
  fields: Array<FieldName<TValues>>;
  valid: boolean;
  dirty: boolean;
  touched: boolean;
  errorCount: number;
}

/** Serializable inspection snapshot for form. */
export interface FormInspection<TValues extends FormValues = FormValues> extends FormSnapshot<TValues> {
  fields: Array<FormFieldInspection<TValues>>;
  groups: Array<FormGroupInspection<TValues>>;
  errorSummary: Array<FormErrorSummaryItem<TValues>>;
  fieldCount: number;
  touchedFields: string[];
  dirtyFields: string[];
  errorFields: string[];
  disabledFields: string[];
  readOnlyFields: string[];
  dirtyForm: boolean;
  touchedForm: boolean;
  submittable: boolean;
}

/** Result returned by form submit flows. */
export interface FormSubmitResult<TValues extends FormValues = FormValues> {
  valid: boolean;
  submitted: boolean;
  snapshot: FormSnapshot<TValues>;
}

declare const FORM_FIELD_ARRAY_ITEM_ID_TYPE: unique symbol;

/** Stable controller-owned identity for one field-array item. */
export type FormFieldArrayItemId = string & {
  readonly [FORM_FIELD_ARRAY_ITEM_ID_TYPE]: true;
};

/** Mutation kinds emitted by field-array change sets. */
export type FormFieldArrayOperation =
  | "insert"
  | "remove"
  | "move"
  | "duplicate"
  | "reset"
  | "set-value"
  | "set-metadata"
  | "touch"
  | "set-errors"
  | "focus";

/** Why a deterministic field-array item identity is being allocated. */
export type FormFieldArrayIdReason = "initial" | "insert" | "duplicate" | "external";

/** Immutable context supplied to an injected field-array identity provider. */
export interface FormFieldArrayIdContext {
  readonly sequence: number;
  readonly reason: FormFieldArrayIdReason;
  readonly sourceId?: FormFieldArrayItemId;
}

/** Deterministic provider used to allocate stable field-array item identities. */
export type FormFieldArrayIdProvider = (context: FormFieldArrayIdContext) => string;

/** Safety bounds applied to field-array values, identities, errors, and metadata. */
export const FORM_FIELD_ARRAY_LIMITS: Readonly<{
  maxItems: 10_000;
  maxIdLength: 256;
  maxErrorsPerItem: 256;
  maxErrorLength: 4096;
  maxFieldMetadataEntries: 256;
  maxFieldMetadataKeyLength: 256;
}> = Object.freeze({
  maxItems: 10_000,
  maxIdLength: 256,
  maxErrorsPerItem: 256,
  maxErrorLength: 4096,
  maxFieldMetadataEntries: 256,
  maxFieldMetadataKeyLength: 256,
});

/** Optional lower field-array bounds and deterministic identity allocation. */
export interface FormFieldArrayOptions {
  idProvider?: FormFieldArrayIdProvider;
  maxItems?: number;
  maxErrorsPerItem?: number;
  maxFieldMetadataEntries?: number;
}

/** Per-item UI state retained by stable identity while array indexes change. */
export interface FormFieldArrayItemMetadata {
  readonly touched: boolean;
  readonly errors: readonly string[];
  readonly focused: boolean;
  readonly fieldMetadata: Readonly<Record<string, unknown>>;
}

/** Partial per-item UI state accepted by insert and metadata mutations. */
export interface FormFieldArrayItemMetadataPatch {
  touched?: boolean;
  errors?: readonly string[];
  focused?: boolean;
  fieldMetadata?: Readonly<Record<string, unknown>>;
}

/** Clone-safe immutable inspection row for one field-array item. */
export interface FormFieldArrayItemInspection<TItem> extends FormFieldArrayItemMetadata {
  readonly id: FormFieldArrayItemId;
  readonly value: TItem;
}

/** Clone-safe immutable field-array snapshot. */
export interface FormFieldArrayInspection<TItem> {
  readonly path: string;
  readonly revision: number;
  readonly length: number;
  readonly items: readonly FormFieldArrayItemInspection<TItem>[];
}

/** Immutable reversible result of one already-applied field-array mutation. */
export interface FormFieldArrayChange<TItem> {
  readonly operation: FormFieldArrayOperation;
  readonly changed: boolean;
  readonly itemId?: FormFieldArrayItemId;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  readonly before: FormFieldArrayInspection<TItem>;
  readonly after: FormFieldArrayInspection<TItem>;
}

/** Optional metadata for adapting one applied field-array change to shared history. */
export interface FormFieldArrayHistoryOptions {
  id?: string;
  label?: string;
  group?: string;
}

/** Controls whether duplicate copies transient touched and validation state. */
export interface FormFieldArrayDuplicateOptions {
  copyInteractionState?: boolean;
}

/** Sync history entry produced without coupling a field array to a HistoryStack. */
export interface FormFieldArrayHistoryTransaction {
  id?: string;
  label: string;
  group?: string;
  undo: () => void;
  redo: () => void;
}

const FORM_FIELD_ARRAY_ACCESS = Symbol("FormController.fieldArrayAccess");

interface FormFieldArrayAccess<TItem> {
  readonly path: string;
  read(): unknown;
  write(items: TItem[]): void;
  revision(): number;
  assertCurrent(): void;
  attach(owner: object, disposeFromOwner: () => void): void;
  release(owner: object): void;
}

interface RegisteredFormField<TValues extends FormValues> {
  readonly name: FieldName<TValues>;
  readonly identity: string;
  readonly path: FormPath<TValues>;
  readonly field: FormField<unknown, TValues>;
  readonly token: object;
}

class ManagedFormValuesSignal<TValues extends FormValues> extends Signal<TValues> {
  readonly #replace: (values: TValues, propagate: boolean) => void;
  #ownerOperation = false;

  constructor(values: TValues, replace: (values: TValues, propagate: boolean) => void) {
    super(values);
    this.#replace = replace;
  }

  override get value(): TValues {
    return super.value;
  }

  override set value(values: TValues) {
    if (this.#ownerOperation) super.value = values;
    else if (!Object.is(this.peek(), values)) this.#replace(values, true);
  }

  override jink(values: TValues): void {
    if (this.#ownerOperation) super.jink(values);
    else if (!Object.is(this.peek(), values)) this.#replace(values, false);
  }

  override dispose(): void {
    if (this.#ownerOperation) super.dispose();
    else throw new FormPathError("UNSUPPORTED_CONTAINER", "FormController owns the lifecycle of its values signal");
  }

  replaceFromOwner(values: TValues): void {
    this.#ownerOperation = true;
    try {
      super.value = values;
    } finally {
      this.#ownerOperation = false;
    }
  }

  jinkFromOwner(values: TValues): void {
    this.#ownerOperation = true;
    try {
      super.jink(values);
    } finally {
      this.#ownerOperation = false;
    }
  }

  disposeFromOwner(): void {
    this.#ownerOperation = true;
    try {
      super.dispose();
    } finally {
      this.#ownerOperation = false;
    }
  }
}

/** State controller for form behavior. */
export class FormController<TValues extends FormValues = FormValues> {
  readonly values: Signal<TValues>;
  readonly errors: Signal<Record<string, string[]>> = new Signal<Record<string, string[]>>(
    createFormRecord<string[]>(),
    { deepObserve: true, watchObjectIndex: true },
  );
  readonly touched: Signal<Record<string, boolean>> = new Signal<Record<string, boolean>>(
    createFormRecord<boolean>(),
    { deepObserve: true, watchObjectIndex: true },
  );
  readonly dirty: Signal<Record<string, boolean>> = new Signal<Record<string, boolean>>(
    createFormRecord<boolean>(),
    { deepObserve: true, watchObjectIndex: true },
  );

  private readonly fields = new Map<string, RegisteredFormField<TValues>>();
  private readonly managedValues: ManagedFormValuesSignal<TValues>;
  private initialValues: TValues;
  private valuesRevision = 0;
  private fieldRevision = 0;
  private controllerDisposed = false;
  private readonly schema?: FormSchemaAdapter<TValues>;
  private readonly fieldArrays = new Map<object, () => void>();

  constructor(fieldsOrOptions: readonly FormField<unknown, TValues>[] | FormControllerOptions<TValues> = []) {
    const options: FormControllerOptions<TValues> = isFormFieldArray(fieldsOrOptions)
      ? { fields: fieldsOrOptions }
      : fieldsOrOptions;
    this.initialValues = {} as TValues;
    this.managedValues = new ManagedFormValuesSignal<TValues>(
      createReactiveFormValues(
        {} as TValues,
        (values, source) => this.prepareDirectValuesMutation(values, source),
      ),
      (values, propagate) => this.replaceValues(values, propagate),
    );
    this.values = this.managedValues;
    this.schema = options.schema;
    for (const field of [...schemaFields(options.schema), ...(options.fields ?? [])]) {
      this.register(field);
    }
  }

  register<TValue>(field: FormField<TValue, TValues>): () => void {
    this.assertActive();
    const normalized = normalizeFieldReference(field.name);
    this.assertNoPathCollision(normalized.name, normalized.identity, normalized.path);
    const source = this.values.peek();
    const revision = this.valuesRevision;
    const fieldRevision = this.fieldRevision;
    const defaultValue = cloneFormData(field.initialValue, `${normalized.path.canonical}:default`);
    const currentValue = cloneFormData(field.initialValue, `${normalized.path.canonical}:current`);
    const inspectedInitialValue = cloneFormData(field.initialValue, `${normalized.path.canonical}:field`);
    const nextInitialValues = setFormPath(this.initialValues, normalized.path, defaultValue);
    const nextValues = setFormPath(source, normalized.path, currentValue);
    const normalizedField: FormField<unknown, TValues> = {
      ...field,
      name: normalized.name,
      initialValue: inspectedInitialValue,
      ...(field.validators ? { validators: Object.freeze(field.validators.slice()) } : {}),
    } as FormField<unknown, TValues>;
    const registered: RegisteredFormField<TValues> = {
      name: normalized.name,
      identity: normalized.identity,
      path: normalized.path,
      field: normalizedField,
      token: {},
    };
    const errors = this.fieldErrors(registered, nextValues);
    this.assertValuesVersion(source, revision, fieldRevision);
    cloneFormData(nextInitialValues, "$defaults:registration");
    cloneFormData(nextValues, "$values:registration");
    this.initialValues = nextInitialValues;
    this.fields.set(normalized.identity, registered);
    this.fieldRevision += 1;
    batchSignalUpdates(() => {
      this.commitValues(nextValues);
      this.errors.value[registered.name] = errors;
      this.touched.value[registered.name] = false;
      this.dirty.value[registered.name] = false;
    });
    return () => {
      if (this.fields.get(normalized.identity)?.token === registered.token) {
        this.unregisterRegistered(registered);
      }
    };
  }

  registerAll(fields: Iterable<FormField<unknown, TValues>>): () => void {
    return DisposableStack.collect((stack) => {
      for (const field of fields) stack.defer(this.register(field));
    });
  }

  unregister(name: FieldName<TValues> | FormPath<TValues>): void {
    this.assertActive();
    const registered = this.registeredField(name);
    if (!registered) return;
    this.unregisterRegistered(registered);
  }

  private unregisterRegistered(registered: RegisteredFormField<TValues>): void {
    const nextValues = deleteFormPath(this.values.peek(), registered.path, { pruneEmpty: true });
    const nextInitialValues = deleteFormPath(this.initialValues, registered.path, { pruneEmpty: true });
    this.fields.delete(registered.identity);
    this.fieldRevision += 1;
    this.initialValues = nextInitialValues;
    batchSignalUpdates(() => {
      this.commitValues(nextValues);
      deleteFormRecordKey(this.errors, registered.name);
      deleteFormRecordKey(this.touched, registered.name);
      deleteFormRecordKey(this.dirty, registered.name);
    });
  }

  setValue<TName extends FieldName<TValues>>(name: TName, value: FormFieldValue<TValues, TName>): boolean;
  setValue<TValue>(name: FormPath<TValues, TValue>, value: TValue): boolean;
  setValue(name: FieldName<TValues> | FormPath<TValues>, value: unknown): boolean;
  setValue(name: FieldName<TValues> | FormPath<TValues>, value: unknown): boolean {
    this.assertActive();
    const registered = this.registeredField(name);
    return registered ? this.setRegisteredValue(registered, value) : false;
  }

  getValue<TValue = unknown>(name: FieldName<TValues> | FormPath<TValues, TValue>): TValue | undefined {
    const registered = this.registeredField(name);
    return registered ? getFormPath(this.values.peek(), registered.path) as TValue | undefined : undefined;
  }

  touch(name: FieldName<TValues> | FormPath<TValues>): void {
    this.assertActive();
    const registered = this.registeredField(name);
    if (registered) this.touchRegistered(registered);
  }

  touchAll(): void {
    this.assertActive();
    for (const registered of this.fields.values()) {
      this.touchRegistered(registered);
    }
  }

  validateField(name: FieldName<TValues> | FormPath<TValues>): boolean {
    this.assertActive();
    const registered = this.registeredField(name);
    return registered ? this.validateRegistered(registered) : true;
  }

  validate(): boolean {
    this.assertActive();
    const source = this.values.peek();
    const revision = this.valuesRevision;
    const fieldRevision = this.fieldRevision;
    const nextErrors = createFormRecord<string[]>();
    let valid = true;
    for (const registered of this.fields.values()) {
      const errors = this.fieldErrors(registered, source);
      nextErrors[registered.name] = errors;
      valid = errors.length === 0 && valid;
    }
    const schemaErrors = (this.schema?.validate?.(source) ?? {}) as Record<
      string,
      readonly string[] | string | undefined
    >;
    for (const [name, messages] of ownDataEntries(schemaErrors, "$schema")) {
      const registered = this.registeredFieldByName(name);
      if (!registered || this.fieldDisabled(registered)) continue;
      const normalized = normalizeSchemaMessages(messages);
      nextErrors[name] = appendMessages(nextErrors[name] ?? [], normalized);
      valid = normalized.length === 0 && valid;
    }
    this.assertValuesVersion(source, revision, fieldRevision);
    batchSignalUpdates(() => replaceFormRecord(this.errors, nextErrors));
    return valid;
  }

  isValid(): boolean {
    for (const [, errors] of ownDataEntries(this.errors.peek(), "$errors")) {
      if (errors.length > 0) return false;
    }
    return true;
  }

  isDirty(): boolean {
    for (const [, dirty] of ownDataEntries(this.dirty.peek(), "$dirty")) {
      if (dirty) return true;
    }
    return false;
  }

  isTouched(): boolean {
    for (const [, touched] of ownDataEntries(this.touched.peek(), "$touched")) {
      if (touched) return true;
    }
    return false;
  }

  fieldNames(): Array<FieldName<TValues>> {
    const names: Array<FieldName<TValues>> = [];
    for (const field of this.fields.values()) names.push(field.name);
    return names;
  }

  field(name: FieldName<TValues> | FormPath<TValues>): FormField<unknown, TValues> | undefined {
    const registered = this.registeredField(name);
    if (!registered) return undefined;
    const field = registered.field;
    return {
      ...field,
      initialValue: cloneFormData(field.initialValue, `${registered.path.canonical}:inspection`),
      ...(field.validators ? { validators: field.validators.slice() } : {}),
    };
  }

  setFieldDisabled(name: FieldName<TValues> | FormPath<TValues>, disabled: FormFieldState): boolean {
    return this.updateFieldState(name, { disabled });
  }

  setFieldReadOnly(name: FieldName<TValues> | FormPath<TValues>, readOnly: FormFieldState): boolean {
    return this.updateFieldState(name, { readOnly });
  }

  isFieldDisabled(name: FieldName<TValues> | FormPath<TValues>): boolean {
    const registered = this.registeredField(name);
    return registered ? this.fieldDisabled(registered) : false;
  }

  isFieldReadOnly(name: FieldName<TValues> | FormPath<TValues>): boolean {
    const registered = this.registeredField(name);
    return registered ? this.fieldReadOnly(registered) : false;
  }

  canEditField(name: FieldName<TValues> | FormPath<TValues>): boolean {
    const registered = this.registeredField(name);
    return registered !== undefined && this.canEditRegistered(registered);
  }

  canSubmit(): boolean {
    for (const registered of this.fields.values()) {
      if (!this.fieldDisabled(registered)) return true;
    }
    return false;
  }

  setValues(values: FormValuesPatch<TValues>): void {
    this.assertActive();
    for (const registered of this.fields.values()) {
      const candidate = readFormPath(values, registered.path);
      if (candidate.found) this.setRegisteredValue(registered, candidate.value);
    }
  }

  reset(values: FormValuesPatch<TValues> = {} as FormValuesPatch<TValues>): void {
    this.assertActive();
    const source = this.values.peek();
    const revision = this.valuesRevision;
    const fieldRevision = this.fieldRevision;
    let nextValues = source;
    const nextErrors = createFormRecord<string[]>();
    const nextTouched = createFormRecord<boolean>();
    const nextDirty = createFormRecord<boolean>();
    for (const registered of this.fields.values()) {
      const candidate = readFormPath(values, registered.path);
      const source = candidate.found ? candidate.value : this.initialValue(registered);
      const value = cloneFormData(source, `${registered.path.canonical}:reset`);
      nextValues = setFormPath(nextValues, registered.path, value);
      nextErrors[registered.name] = [];
      nextTouched[registered.name] = false;
      nextDirty[registered.name] = false;
    }
    this.assertValuesVersion(source, revision, fieldRevision);
    batchSignalUpdates(() => {
      this.commitValues(nextValues);
      replaceFormRecord(this.errors, nextErrors);
      replaceFormRecord(this.touched, nextTouched);
      replaceFormRecord(this.dirty, nextDirty);
    });
  }

  async submit(
    onSubmit?: (snapshot: FormSnapshot<TValues>) => void | Promise<void>,
  ): Promise<FormSubmitResult<TValues>> {
    this.assertActive();
    this.touchAll();
    const valid = this.validate();
    const snapshot = this.snapshot();
    const submitted = valid && this.canSubmit();
    if (submitted) await onSubmit?.(snapshot);
    return { valid, submitted, snapshot };
  }

  snapshot(): FormSnapshot<TValues> {
    return {
      values: cloneFormData(this.values.peek(), "$values") as TValues,
      errors: cloneRecord(this.errors.peek()),
      touched: cloneBooleanRecord(this.touched.peek(), "$touched"),
      dirty: cloneBooleanRecord(this.dirty.peek(), "$dirty"),
      valid: this.isValid(),
    };
  }

  inspect(): FormInspection<TValues> {
    const snapshot = this.snapshot();
    const fields: Array<FormFieldInspection<TValues>> = [];
    const errorSummary: Array<FormErrorSummaryItem<TValues>> = [];
    const touchedFields: string[] = [];
    const dirtyFields: string[] = [];
    const errorFields: string[] = [];
    const disabledFields: string[] = [];
    const readOnlyFields: string[] = [];
    let dirtyForm = false;
    let touchedForm = false;
    let submittable = false;
    for (const registered of this.fields.values()) {
      const name = registered.name;
      const errors = snapshot.errors[name] ?? [];
      const field = registered.field;
      const touched = snapshot.touched[name] ?? false;
      const dirty = snapshot.dirty[name] ?? false;
      const disabled = this.fieldDisabled(registered);
      const readOnly = this.fieldReadOnly(registered);
      const valid = errors.length === 0;
      const inspection: FormFieldInspection<TValues> = {
        name: registered.name,
        touched,
        dirty,
        disabled,
        readOnly,
        errors,
        valid,
      };
      if (field?.label !== undefined) inspection.label = field.label;
      if (field?.group !== undefined) inspection.group = field.group;
      fields.push(inspection);
      if (touched) {
        touchedFields.push(name);
        touchedForm = true;
      }
      if (dirty) {
        dirtyFields.push(name);
        dirtyForm = true;
      }
      if (!valid) errorFields.push(name);
      if (disabled) disabledFields.push(name);
      else submittable = true;
      if (readOnly) readOnlyFields.push(name);
      if (errors.length > 0) {
        const item: FormErrorSummaryItem<TValues> = { name: inspection.name, errors: errors.slice() };
        if (field?.label !== undefined) item.label = field.label;
        if (field?.group !== undefined) item.group = field.group;
        errorSummary.push(item);
      }
    }
    return {
      ...snapshot,
      fields,
      groups: inspectFormGroups(fields),
      errorSummary,
      fieldCount: fields.length,
      touchedFields,
      dirtyFields,
      errorFields,
      disabledFields,
      readOnlyFields,
      dirtyForm,
      touchedForm,
      submittable,
    };
  }

  dispose(): void {
    if (this.controllerDisposed) return;
    this.controllerDisposed = true;
    this.valuesRevision += 1;
    this.fieldRevision += 1;
    for (const disposeFromOwner of [...this.fieldArrays.values()]) disposeFromOwner();
    this.fieldArrays.clear();
    this.fields.clear();
    this.initialValues = {} as TValues;
    this.managedValues.disposeFromOwner();
    this.errors.dispose();
    this.touched.dispose();
    this.dirty.dispose();
  }

  [FORM_FIELD_ARRAY_ACCESS]<TItem>(path: FormPath<TValues, readonly TItem[]>): FormFieldArrayAccess<TItem> {
    this.assertActive();
    const registered = this.registeredField(path);
    if (!registered) {
      throw new FormPathError(
        "MISSING_SEGMENT",
        "A field array must address an exactly registered form field",
        isFormPath(path) ? path.canonical : "$field-array",
      );
    }
    const token = registered.token;
    const currentRegistration = (): RegisteredFormField<TValues> => {
      this.assertActive();
      const current = this.fields.get(registered.identity);
      if (current?.token !== token) {
        throw new FormPathError(
          "ACCESS_FAILED",
          "A stale field-array controller cannot access a replaced or unregistered field",
          registered.path.canonical,
        );
      }
      return current;
    };
    const assertCurrent = () => void currentRegistration();
    return {
      path: registered.path.canonical,
      read: () => {
        const current = currentRegistration();
        return getFormPath(this.values.peek(), current.path);
      },
      write: (items) => {
        const current = currentRegistration();
        if (!this.setRegisteredValue(current, items)) {
          throw new FormPathError(
            "ACCESS_FAILED",
            "A disabled or read-only field array cannot be mutated",
            registered.path.canonical,
          );
        }
      },
      revision: () => {
        assertCurrent();
        return this.valuesRevision;
      },
      assertCurrent,
      attach: (owner, disposeFromOwner) => {
        assertCurrent();
        this.fieldArrays.set(owner, disposeFromOwner);
      },
      release: (owner) => {
        this.fieldArrays.delete(owner);
      },
    };
  }

  private initialValue(registered: RegisteredFormField<TValues>): unknown {
    return getFormPath(this.initialValues, registered.path);
  }

  private commitValues(values: TValues): void {
    const ownedValues = cloneFormData(values, "$values:commit") as TValues;
    this.managedValues.replaceFromOwner(
      createReactiveFormValues(
        ownedValues,
        (nextValues, source) => this.prepareDirectValuesMutation(nextValues, source),
      ),
    );
    this.valuesRevision += 1;
  }

  private setRegisteredValue(registered: RegisteredFormField<TValues>, value: unknown): boolean {
    const fieldRevision = this.fieldRevision;
    if (!this.canEditRegistered(registered)) {
      this.assertFieldRevision(fieldRevision);
      return false;
    }
    const source = this.values.peek();
    const revision = this.valuesRevision;
    const cloned = cloneFormData(value, `${registered.path.canonical}:value`);
    const nextValues = setFormPath(source, registered.path, cloned);
    const errors = this.fieldErrors(registered, nextValues);
    const dirty = !formDataEquals(cloned, this.initialValue(registered));
    this.assertValuesVersion(source, revision, fieldRevision);
    batchSignalUpdates(() => {
      this.commitValues(nextValues);
      this.errors.value[registered.name] = errors;
      this.dirty.value[registered.name] = dirty;
    });
    return true;
  }

  private touchRegistered(registered: RegisteredFormField<TValues>): void {
    this.touched.value[registered.name] = true;
  }

  private validateRegistered(registered: RegisteredFormField<TValues>): boolean {
    const source = this.values.peek();
    const revision = this.valuesRevision;
    const fieldRevision = this.fieldRevision;
    const errors = this.fieldErrors(registered, source);
    this.assertValuesVersion(source, revision, fieldRevision);
    this.errors.value[registered.name] = errors;
    return errors.length === 0;
  }

  private fieldErrors(registered: RegisteredFormField<TValues>, values: TValues): string[] {
    if (this.fieldDisabled(registered)) return [];
    const value = getFormPath(values, registered.path);
    const validators = registered.field.validators ?? [];
    const errors: string[] = [];
    for (let index = 0; index < validators.length; index += 1) {
      const message = validators[index]!(value, values);
      if (message) errors.push(message);
    }
    return errors;
  }

  private fieldDisabled(registered: RegisteredFormField<TValues>): boolean {
    return resolveFieldState(registered.field.disabled);
  }

  private fieldReadOnly(registered: RegisteredFormField<TValues>): boolean {
    return resolveFieldState(registered.field.readOnly);
  }

  private canEditRegistered(registered: RegisteredFormField<TValues>): boolean {
    return !this.fieldDisabled(registered) && !this.fieldReadOnly(registered);
  }

  private assertActive(): void {
    if (this.controllerDisposed) {
      throw new FormPathError("ACCESS_FAILED", "A disposed form controller cannot be mutated");
    }
  }

  private assertFieldRevision(revision: number): void {
    this.assertActive();
    if (this.fieldRevision !== revision) {
      throw new FormPathError("ACCESS_FAILED", "Form field state changed during a state callback");
    }
  }

  private assertValuesVersion(source: TValues, revision: number, fieldRevision: number): void {
    this.assertFieldRevision(fieldRevision);
    if (this.values.peek() !== source || this.valuesRevision !== revision) {
      throw new FormPathError("ACCESS_FAILED", "Form values changed during a state callback");
    }
  }

  private prepareDirectValuesMutation(
    values: TValues,
    source: TValues,
  ): PreparedReactiveFormMutation {
    this.assertActive();
    const revision = this.valuesRevision;
    const fieldRevision = this.fieldRevision;
    const assertCurrent = () => {
      this.assertFieldRevision(fieldRevision);
      if (this.values.peek() !== source || this.valuesRevision !== revision) {
        throw new FormPathError("ACCESS_FAILED", "A stale form value reference cannot be mutated");
      }
    };
    assertCurrent();
    const nextErrors = createFormRecord<string[]>();
    const nextDirty = createFormRecord<boolean>();
    for (const registered of this.fields.values()) {
      nextErrors[registered.name] = this.fieldErrors(registered, values);
      nextDirty[registered.name] = !formDataEquals(
        getFormPath(values, registered.path),
        this.initialValue(registered),
      );
    }
    return {
      assertCurrent,
      commit: (propagateValues = true) => {
        this.valuesRevision += 1;
        batchSignalUpdates(() => {
          replaceFormRecord(this.errors, nextErrors);
          replaceFormRecord(this.dirty, nextDirty);
          if (propagateValues) this.values.propagate();
        });
      },
    };
  }

  private replaceValues(values: TValues, propagate: boolean): void {
    const nextValues = cloneFormData(values, "$values:replacement") as TValues;
    const prepared = this.prepareDirectValuesMutation(nextValues, this.values.peek());
    const reactive = createReactiveFormValues(
      nextValues,
      (candidate, source) => this.prepareDirectValuesMutation(candidate, source),
    );
    prepared.assertCurrent();
    batchSignalUpdates(() => {
      if (propagate) this.managedValues.replaceFromOwner(reactive);
      else this.managedValues.jinkFromOwner(reactive);
      prepared.commit(propagate);
    });
  }

  private updateFieldState(
    name: FieldName<TValues> | FormPath<TValues>,
    patch: Pick<Partial<FormField<unknown, TValues>>, "disabled" | "readOnly">,
  ): boolean {
    this.assertActive();
    const registered = this.registeredField(name);
    if (!registered) return false;
    const fieldRevision = this.fieldRevision;
    const next = { ...registered, field: { ...registered.field, ...patch } };
    const disabled = patch.disabled !== undefined && this.fieldDisabled(next);
    this.assertFieldRevision(fieldRevision);
    this.fields.set(registered.identity, next);
    this.fieldRevision += 1;
    if (disabled) {
      this.errors.value[registered.name] = [];
    }
    return true;
  }

  private registeredField(name: FieldName<TValues> | FormPath<TValues>): RegisteredFormField<TValues> | undefined {
    if (isFormPath(name)) return this.fields.get(`path:${name.canonical}`);
    if (typeof name !== "string") return undefined;
    return this.fields.get(`flat:${JSON.stringify(name)}`) ?? this.fields.get(`path:${name}`);
  }

  private registeredFieldByName(name: string): RegisteredFormField<TValues> | undefined {
    for (const registered of this.fields.values()) {
      if (registered.name === name) return registered;
    }
    return undefined;
  }

  private assertNoPathCollision(name: FieldName<TValues>, identity: string, path: FormPath<TValues>): void {
    for (const registered of this.fields.values()) {
      if (registered.identity === identity) continue;
      if (
        registered.name === name || pathsOverlap(registered.path.segments, path.segments)
      ) {
        throw new FormPathError(
          "IDENTITY_COLLISION",
          `Field '${name}' collides with registered field '${registered.name}'`,
          path.canonical,
        );
      }
    }
  }
}

interface NormalizedFormFieldArrayLimits {
  readonly maxItems: number;
  readonly maxErrorsPerItem: number;
  readonly maxFieldMetadataEntries: number;
}

interface OwnedFormFieldArrayItem<TItem> {
  readonly id: FormFieldArrayItemId;
  readonly value: TItem;
  readonly metadata: FormFieldArrayItemMetadata;
}

interface OwnedFormFieldArrayState<TItem> {
  readonly sequence: number;
  readonly items: readonly OwnedFormFieldArrayItem<TItem>[];
}

interface OwnedFormFieldArrayChange<TItem> {
  readonly before: OwnedFormFieldArrayState<TItem>;
  readonly after: OwnedFormFieldArrayState<TItem>;
  readonly beforeLineage: object;
  readonly afterLineage: object;
}

interface FormFieldArrayChangeDetail {
  readonly operation: FormFieldArrayOperation;
  readonly itemId?: FormFieldArrayItemId;
  readonly fromIndex?: number;
  readonly toIndex?: number;
}

/**
 * Stable-ID field-array controller for one exactly registered typed form path.
 *
 * Item identities and renderer metadata remain outside submitted form values.
 * Mutations return already-applied change sets; adapt one with
 * {@link historyTransaction} and push it into a caller-owned history stack or
 * transaction scope.
 */
export class FormFieldArrayController<TValues extends FormValues, TItem> {
  readonly #access: FormFieldArrayAccess<TItem>;
  readonly #idProvider: FormFieldArrayIdProvider;
  readonly #limits: NormalizedFormFieldArrayLimits;
  readonly #changes = new WeakMap<FormFieldArrayChange<TItem>, OwnedFormFieldArrayChange<TItem>>();
  #initial: OwnedFormFieldArrayState<TItem>;
  #state: OwnedFormFieldArrayState<TItem>;
  #revision = 0;
  #lineage: object = Object.freeze({});
  #mutating = false;
  #disposed = false;

  constructor(
    form: FormController<TValues>,
    path: FormPath<TValues, readonly TItem[]>,
    options: FormFieldArrayOptions = {},
  ) {
    const normalized = normalizeFormFieldArrayOptions(options);
    this.#limits = normalized.limits;
    this.#idProvider = normalized.idProvider;
    this.#access = form[FORM_FIELD_ARRAY_ACCESS](path);
    this.#mutating = true;
    try {
      const hostRevision = this.#access.revision();
      const values = cloneDenseFieldArray<TItem>(
        this.#access.read(),
        this.#limits.maxItems,
        this.#access.path,
      );
      this.#state = this.#allocateState(values, "initial", 0);
      this.#initial = cloneOwnedFieldArrayState(this.#state);
      this.#assertHostRevision(hostRevision);
      this.#access.attach(this, () => this.#disposeFromOwner());
    } finally {
      this.#mutating = false;
    }
  }

  /** Current item count after reconciling safe external whole-field changes. */
  get length(): number {
    return this.#read(() => this.#state.items.length);
  }

  /** Immutable stable identities in current visual order. */
  ids(): readonly FormFieldArrayItemId[] {
    return this.#read(() => Object.freeze(this.#state.items.map((item) => item.id)));
  }

  /** Returns the stable identity at an array index. */
  idAt(index: number): FormFieldArrayItemId | undefined {
    return this.#read(() => {
      assertFieldArrayReadIndex(index, this.#state.items.length, true, this.#access.path);
      return this.#state.items[index]?.id;
    });
  }

  /** Returns the current index of a stable identity, or -1 when absent. */
  indexOf(id: FormFieldArrayItemId): number {
    return this.#read(() => this.#indexOf(id));
  }

  /** Returns one immutable clone-safe item inspection by stable identity. */
  item(id: FormFieldArrayItemId): FormFieldArrayItemInspection<TItem> | undefined {
    return this.#read(() => {
      const index = this.#indexOf(id);
      return index < 0 ? undefined : inspectOwnedFieldArrayItem(this.#state.items[index]!);
    });
  }

  /** Returns a complete immutable clone-safe field-array inspection. */
  inspect(): FormFieldArrayInspection<TItem> {
    return this.#read(() => inspectOwnedFieldArrayState(this.#state, this.#access.path, this.#revision));
  }

  /** Inserts a defensively cloned value and returns its reversible change set. */
  insert(
    index: number,
    value: TItem,
    metadata: FormFieldArrayItemMetadataPatch = {},
  ): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "insert", toIndex: index }, (before) => {
      assertFieldArrayInsertIndex(index, before.items.length, this.#access.path);
      assertFieldArrayCapacity(before.items.length, this.#limits.maxItems, this.#access.path);
      const allocated = this.#allocateId(before, "insert");
      const item = ownedFieldArrayItem(
        allocated.id,
        cloneAndFreezeFormValue(value, "$field-array:insert") as TItem,
        normalizeFieldArrayMetadataPatch(metadata, undefined, this.#limits, this.#access.path),
      );
      const items = before.items.slice();
      if (item.metadata.focused) clearFocusedFieldArrayItems(items);
      items.splice(index, 0, item);
      return ownedFieldArrayState(allocated.sequence, items);
    });
  }

  /** Removes an item by stable identity and preserves it in the change set. */
  remove(id: FormFieldArrayItemId): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "remove", itemId: id }, (before, detail) => {
      const index = findRequiredFieldArrayItem(before, id, this.#access.path);
      detail.fromIndex = index;
      const items = before.items.slice();
      items.splice(index, 1);
      return ownedFieldArrayState(before.sequence, items);
    });
  }

  /** Moves an item by stable identity to a final bounded array index. */
  move(id: FormFieldArrayItemId, toIndex: number): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "move", itemId: id, toIndex }, (before, detail) => {
      const fromIndex = findRequiredFieldArrayItem(before, id, this.#access.path);
      assertFieldArrayReadIndex(toIndex, before.items.length, false, this.#access.path);
      detail.fromIndex = fromIndex;
      if (fromIndex === toIndex) return before;
      const items = before.items.slice();
      const [item] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, item!);
      return ownedFieldArrayState(before.sequence, items);
    });
  }

  /** Duplicates a value under a fresh stable identity. */
  duplicate(
    id: FormFieldArrayItemId,
    toIndex?: number,
    options: FormFieldArrayDuplicateOptions = {},
  ): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "duplicate", itemId: id, toIndex }, (before, detail) => {
      const fromIndex = findRequiredFieldArrayItem(before, id, this.#access.path);
      const target = toIndex ?? fromIndex + 1;
      assertFieldArrayInsertIndex(target, before.items.length, this.#access.path);
      assertFieldArrayCapacity(before.items.length, this.#limits.maxItems, this.#access.path);
      const copyInteractionState = readDuplicateInteractionOption(options);
      const source = before.items[fromIndex]!;
      const allocated = this.#allocateId(before, "duplicate", source.id);
      const metadata = ownedFieldArrayMetadata({
        touched: copyInteractionState ? source.metadata.touched : false,
        errors: copyInteractionState ? source.metadata.errors : [],
        focused: false,
        fieldMetadata: source.metadata.fieldMetadata,
      });
      const duplicate = ownedFieldArrayItem(
        allocated.id,
        cloneAndFreezeFormValue(source.value, "$field-array:duplicate") as TItem,
        metadata,
      );
      const items = before.items.slice();
      items.splice(target, 0, duplicate);
      detail.fromIndex = fromIndex;
      detail.toIndex = target;
      return ownedFieldArrayState(allocated.sequence, items);
    });
  }

  /** Restores the values, stable identities, and metadata captured at creation. */
  reset(): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "reset" }, (before) => {
      const initial = cloneOwnedFieldArrayState(this.#initial);
      return ownedFieldArrayState(Math.max(before.sequence, initial.sequence), initial.items);
    });
  }

  /** Replaces one item value without changing its stable identity or metadata. */
  setValue(id: FormFieldArrayItemId, value: TItem): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "set-value", itemId: id }, (before, detail) => {
      const index = findRequiredFieldArrayItem(before, id, this.#access.path);
      detail.fromIndex = index;
      detail.toIndex = index;
      const current = before.items[index]!;
      const nextValue = cloneAndFreezeFormValue(value, "$field-array:set-value") as TItem;
      if (equalClonedFormData(current.value, nextValue)) return before;
      const items = before.items.slice();
      items[index] = ownedFieldArrayItem(current.id, nextValue, current.metadata);
      return ownedFieldArrayState(before.sequence, items);
    });
  }

  /** Applies a bounded metadata patch by stable item identity. */
  setItemMetadata(
    id: FormFieldArrayItemId,
    patch: FormFieldArrayItemMetadataPatch,
  ): FormFieldArrayChange<TItem> {
    return this.#setItemMetadata("set-metadata", id, patch);
  }

  /** Marks one stable item touched or untouched. */
  touch(id: FormFieldArrayItemId, touched = true): FormFieldArrayChange<TItem> {
    return this.#setItemMetadata("touch", id, { touched });
  }

  /** Replaces bounded validation messages for one stable item. */
  setErrors(id: FormFieldArrayItemId, errors: readonly string[]): FormFieldArrayChange<TItem> {
    return this.#setItemMetadata("set-errors", id, { errors });
  }

  /** Replaces arbitrary clone-safe renderer metadata for one stable item. */
  setFieldMetadata(
    id: FormFieldArrayItemId,
    fieldMetadata: Readonly<Record<string, unknown>>,
  ): FormFieldArrayChange<TItem> {
    return this.#setItemMetadata("set-metadata", id, { fieldMetadata });
  }

  /** Selects at most one focused item, or clears focus when id is undefined. */
  focus(id?: FormFieldArrayItemId): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation: "focus", itemId: id }, (before) => {
      const targetIndex = id === undefined ? -1 : findRequiredFieldArrayItem(before, id, this.#access.path);
      let changed = false;
      const items = before.items.map((item, index) => {
        const focused = index === targetIndex;
        if (item.metadata.focused === focused) return item;
        changed = true;
        return ownedFieldArrayItem(item.id, item.value, ownedFieldArrayMetadata({ ...item.metadata, focused }));
      });
      return changed ? ownedFieldArrayState(before.sequence, items) : before;
    });
  }

  /**
   * Converts an already-applied change to one synchronous history entry.
   * Push the returned entry; applying it again would intentionally fail its
   * stale-state guard.
   */
  historyTransaction(
    change: FormFieldArrayChange<TItem>,
    options: FormFieldArrayHistoryOptions = {},
  ): FormFieldArrayHistoryTransaction {
    this.#assertReadable();
    const owned = this.#changes.get(change);
    if (!owned) {
      throw new FormPathError(
        "ACCESS_FAILED",
        "A field-array history change must originate from this controller",
        this.#access.path,
      );
    }
    const history = normalizeFieldArrayHistoryOptions(options, change.operation);
    let nextOperation: "undo" | "redo" = "undo";
    const restore = (
      operation: "undo" | "redo",
      target: OwnedFormFieldArrayState<TItem>,
      expected: OwnedFormFieldArrayState<TItem>,
      targetLineage: object,
      expectedLineage: object,
    ): void => {
      if (nextOperation !== operation) {
        throw new FormPathError(
          "ACCESS_FAILED",
          `A field-array history entry cannot ${operation} from its current phase`,
          this.#access.path,
        );
      }
      this.#restore(target, expected, targetLineage, expectedLineage);
      nextOperation = operation === "undo" ? "redo" : "undo";
    };
    const transaction: FormFieldArrayHistoryTransaction = {
      label: history.label,
      undo: () => restore("undo", owned.before, owned.after, owned.beforeLineage, owned.afterLineage),
      redo: () => restore("redo", owned.after, owned.before, owned.afterLineage, owned.beforeLineage),
    };
    if (history.id !== undefined) transaction.id = history.id;
    if (history.group !== undefined) transaction.group = history.group;
    return Object.freeze(transaction);
  }

  /** Releases this controller permanently; the parent form remains active. */
  dispose(): void {
    if (this.#disposed) return;
    if (this.#mutating) {
      throw new FormPathError(
        "ACCESS_FAILED",
        "A field-array controller cannot be disposed during an active operation",
        this.#access.path,
      );
    }
    this.#disposed = true;
    this.#access.release(this);
  }

  #disposeFromOwner(): void {
    this.#disposed = true;
  }

  #setItemMetadata(
    operation: Extract<FormFieldArrayOperation, "set-metadata" | "touch" | "set-errors">,
    id: FormFieldArrayItemId,
    patch: FormFieldArrayItemMetadataPatch,
  ): FormFieldArrayChange<TItem> {
    return this.#mutate({ operation, itemId: id }, (before, detail) => {
      const index = findRequiredFieldArrayItem(before, id, this.#access.path);
      detail.fromIndex = index;
      detail.toIndex = index;
      const current = before.items[index]!;
      const metadata = normalizeFieldArrayMetadataPatch(patch, current.metadata, this.#limits, this.#access.path);
      const items = before.items.slice();
      if (metadata.focused) clearFocusedFieldArrayItems(items, current.id);
      if (fieldArrayMetadataEquals(current.metadata, metadata) && sameOwnedFieldArrayItems(items, before.items)) {
        return before;
      }
      items[index] = ownedFieldArrayItem(current.id, current.value, metadata);
      return ownedFieldArrayState(before.sequence, items);
    });
  }

  #read<TResult>(read: () => TResult): TResult {
    this.#assertReadable();
    this.#mutating = true;
    try {
      this.#synchronize();
      return read();
    } finally {
      this.#mutating = false;
    }
  }

  #mutate(
    detail: FormFieldArrayChangeDetail,
    build: (
      before: OwnedFormFieldArrayState<TItem>,
      detail: { fromIndex?: number; toIndex?: number },
    ) => OwnedFormFieldArrayState<TItem>,
  ): FormFieldArrayChange<TItem> {
    this.#assertReadable();
    this.#mutating = true;
    try {
      this.#synchronize();
      const before = this.#state;
      const beforeLineage = this.#lineage;
      const hostRevision = this.#access.revision();
      const mutableDetail = { fromIndex: detail.fromIndex, toIndex: detail.toIndex };
      const after = build(before, mutableDetail);
      assertOwnedFieldArrayState(after, this.#limits, this.#access.path);
      const changed = !ownedFieldArrayStatesEqual(before, after);
      const beforeRevision = this.#revision;
      this.#assertHostRevision(hostRevision);
      if (changed) this.#commitState(after, before, hostRevision, Object.freeze({}));
      const publicChange: FormFieldArrayChange<TItem> = Object.freeze({
        operation: detail.operation,
        changed,
        ...(detail.itemId === undefined ? {} : { itemId: detail.itemId }),
        ...(mutableDetail.fromIndex === undefined ? {} : { fromIndex: mutableDetail.fromIndex }),
        ...(mutableDetail.toIndex === undefined ? {} : { toIndex: mutableDetail.toIndex }),
        before: inspectOwnedFieldArrayState(before, this.#access.path, beforeRevision),
        after: inspectOwnedFieldArrayState(this.#state, this.#access.path, this.#revision),
      });
      this.#changes.set(publicChange, {
        before: cloneOwnedFieldArrayState(before),
        after: cloneOwnedFieldArrayState(this.#state),
        beforeLineage,
        afterLineage: this.#lineage,
      });
      return publicChange;
    } finally {
      this.#mutating = false;
    }
  }

  #restore(
    target: OwnedFormFieldArrayState<TItem>,
    expected: OwnedFormFieldArrayState<TItem>,
    targetLineage: object,
    expectedLineage: object,
  ): void {
    this.#assertReadable();
    this.#mutating = true;
    try {
      this.#synchronize();
      const hostRevision = this.#access.revision();
      if (this.#lineage !== expectedLineage || !ownedFieldArrayItemsEqual(this.#state, expected)) {
        throw new FormPathError(
          "ACCESS_FAILED",
          "A field-array history entry cannot overwrite divergent current state",
          this.#access.path,
        );
      }
      this.#assertHostRevision(hostRevision);
      const restored = cloneOwnedFieldArrayState(target);
      const next = ownedFieldArrayState(
        Math.max(this.#state.sequence, restored.sequence),
        restored.items,
      );
      if (!ownedFieldArrayStatesEqual(this.#state, next)) {
        this.#commitState(next, this.#state, hostRevision, targetLineage);
      } else {
        this.#lineage = targetLineage;
      }
    } finally {
      this.#mutating = false;
    }
  }

  #commitState(
    next: OwnedFormFieldArrayState<TItem>,
    previous: OwnedFormFieldArrayState<TItem>,
    hostRevision: number,
    nextLineage: object,
  ): void {
    this.#assertHostRevision(hostRevision);
    if (ownedFieldArrayValuesEqual(previous.items, next.items)) {
      this.#state = next;
      this.#lineage = nextLineage;
      this.#revision += 1;
      return;
    }

    const previousLineage = this.#lineage;
    this.#state = next;
    this.#lineage = nextLineage;
    try {
      this.#access.write(next.items.map((item) => cloneFormData(item.value, "$field-array:write") as TItem));
      this.#assertHostRevision(hostRevision + 1);
      this.#revision += 1;
    } catch (error) {
      let committed = false;
      try {
        const current = cloneDenseFieldArray<TItem>(
          this.#access.read(),
          this.#limits.maxItems,
          this.#access.path,
        );
        committed = fieldArrayValuesEqualItems(current, next.items);
      } catch {
        // Keep the prior owned state when the host cannot be inspected safely.
      }
      if (committed) this.#revision += 1;
      else {
        this.#state = previous;
        this.#lineage = previousLineage;
      }
      throw error;
    }
  }

  #synchronize(): void {
    this.#access.assertCurrent();
    const hostRevision = this.#access.revision();
    const values = cloneDenseFieldArray<TItem>(this.#access.read(), this.#limits.maxItems, this.#access.path);
    if (fieldArrayValuesEqualItems(values, this.#state.items)) {
      this.#assertHostRevision(hostRevision);
      return;
    }

    const previous = this.#state;
    const used = new Set<number>();
    const reservedIds = new Set(previous.items.map((item) => item.id));
    const items = new Array<OwnedFormFieldArrayItem<TItem>>(values.length);
    let sequence = previous.sequence;
    for (let index = 0; index < values.length; index += 1) {
      const prior = previous.items[index];
      if (!prior || !equalClonedFormData(prior.value, values[index])) continue;
      used.add(index);
      items[index] = ownedFieldArrayItem(prior.id, values[index]!, prior.metadata);
    }

    const buckets = new Map<string, number[]>();
    const priorFingerprintContext = createFormFieldArrayFingerprintContext();
    for (let priorIndex = 0; priorIndex < previous.items.length; priorIndex += 1) {
      if (used.has(priorIndex)) continue;
      const fingerprint = formFieldArrayValueFingerprint(previous.items[priorIndex]!.value, priorFingerprintContext);
      const bucket = buckets.get(fingerprint);
      if (bucket) bucket.push(priorIndex);
      else buckets.set(fingerprint, [priorIndex]);
    }

    let comparisons = 0;
    const comparisonLimit = Math.max(64, this.#limits.maxItems * 8);
    const valueFingerprintContext = createFormFieldArrayFingerprintContext();
    for (let index = 0; index < values.length; index += 1) {
      if (items[index]) continue;
      let match = -1;
      const fingerprint = formFieldArrayValueFingerprint(values[index], valueFingerprintContext);
      const bucket = buckets.get(fingerprint);
      for (let candidateIndex = 0; bucket && candidateIndex < bucket.length; candidateIndex += 1) {
        const priorIndex = bucket[candidateIndex]!;
        comparisons += 1;
        if (comparisons > comparisonLimit) {
          throw new FormPathError(
            "ENTRY_LIMIT",
            "Field-array reconciliation exceeded its deterministic matching-work bound",
            this.#access.path,
          );
        }
        if (equalClonedFormData(previous.items[priorIndex]!.value, values[index])) {
          match = priorIndex;
          bucket.splice(candidateIndex, 1);
          break;
        }
      }
      if (match >= 0) {
        used.add(match);
        const prior = previous.items[match]!;
        items[index] = ownedFieldArrayItem(prior.id, values[index]!, prior.metadata);
      }
    }

    const unmatchedPrior: number[] = [];
    const unmatchedValues: number[] = [];
    for (let index = 0; index < previous.items.length; index += 1) {
      if (!used.has(index)) unmatchedPrior.push(index);
    }
    for (let index = 0; index < values.length; index += 1) {
      if (!items[index]) unmatchedValues.push(index);
    }
    // When exact matching accounts for every insertion/removal, the remaining
    // ordered one-to-one rows are value edits. Keep their renderer identity and
    // interaction metadata instead of manufacturing replacement rows.
    if (unmatchedPrior.length === unmatchedValues.length) {
      for (let index = 0; index < unmatchedPrior.length; index += 1) {
        const priorIndex = unmatchedPrior[index]!;
        const valueIndex = unmatchedValues[index]!;
        const prior = previous.items[priorIndex]!;
        used.add(priorIndex);
        items[valueIndex] = ownedFieldArrayItem(prior.id, values[valueIndex]!, prior.metadata);
      }
    }

    for (let index = 0; index < values.length; index += 1) {
      if (items[index]) continue;
      const allocated = this.#allocateId(
        ownedFieldArrayState(sequence, []),
        "external",
        undefined,
        reservedIds,
      );
      sequence = allocated.sequence;
      reservedIds.add(allocated.id);
      items[index] = ownedFieldArrayItem(allocated.id, values[index]!, emptyOwnedFieldArrayMetadata());
    }
    const next = ownedFieldArrayState(sequence, items);
    assertOwnedFieldArrayState(next, this.#limits, this.#access.path);
    this.#assertHostRevision(hostRevision);
    this.#state = next;
    this.#lineage = Object.freeze({});
    this.#revision += 1;
  }

  #allocateState(
    values: readonly TItem[],
    reason: FormFieldArrayIdReason,
    sequence: number,
  ): OwnedFormFieldArrayState<TItem> {
    const items: OwnedFormFieldArrayItem<TItem>[] = [];
    const reservedIds = new Set<string>();
    let nextSequence = sequence;
    for (const value of values) {
      const allocated = this.#allocateId(
        ownedFieldArrayState(nextSequence, []),
        reason,
        undefined,
        reservedIds,
      );
      nextSequence = allocated.sequence;
      reservedIds.add(allocated.id);
      items.push(ownedFieldArrayItem(allocated.id, value, emptyOwnedFieldArrayMetadata()));
    }
    return ownedFieldArrayState(nextSequence, items);
  }

  #allocateId(
    state: OwnedFormFieldArrayState<TItem>,
    reason: FormFieldArrayIdReason,
    sourceId?: FormFieldArrayItemId,
    reservedIds?: ReadonlySet<string>,
  ): { readonly id: FormFieldArrayItemId; readonly sequence: number } {
    const sequence = state.sequence + 1;
    if (!Number.isSafeInteger(sequence)) {
      throw new FormPathError("WIDTH_LIMIT", "A field-array identity sequence was exhausted", this.#access.path);
    }
    const context: FormFieldArrayIdContext = Object.freeze({
      sequence,
      reason,
      ...(sourceId === undefined ? {} : { sourceId }),
    });
    const candidate = this.#idProvider(context);
    const id = validateFieldArrayId(candidate, this.#access.path);
    const collides = reservedIds === undefined ? state.items.some((item) => item.id === id) : reservedIds.has(id);
    if (collides) {
      throw new FormPathError(
        "IDENTITY_COLLISION",
        "A field-array identity provider returned a duplicate ID",
        this.#access.path,
      );
    }
    return { id, sequence };
  }

  #indexOf(id: FormFieldArrayItemId): number {
    const normalized = validateFieldArrayId(id, this.#access.path);
    return this.#state.items.findIndex((item) => item.id === normalized);
  }

  #assertReadable(): void {
    if (this.#disposed) {
      throw new FormPathError(
        "ACCESS_FAILED",
        "A disposed field-array controller cannot be accessed",
        this.#access.path,
      );
    }
    if (this.#mutating) {
      throw new FormPathError(
        "ACCESS_FAILED",
        "A field-array controller cannot be reentered during an active operation",
        this.#access.path,
      );
    }
    this.#access.assertCurrent();
  }

  #assertHostRevision(revision: number): void {
    if (this.#access.revision() !== revision) {
      throw new FormPathError(
        "ACCESS_FAILED",
        "Form values changed during a field-array callback",
        this.#access.path,
      );
    }
  }
}

/** Binds form Field behavior and returns a disposer when applicable. */
export function bindFormField<
  TValues extends FormValues,
  TName extends FieldName<TValues>,
  TTarget = FormFieldValue<TValues, TName>,
>(
  form: FormController<TValues>,
  name: TName,
  target: Signal<TTarget>,
  options?: FormFieldBindingOptions<FormFieldValue<TValues, TName>, TTarget>,
): () => void;
/** Binds a typed structured form field to a signal-backed target. */
export function bindFormField<
  TValues extends FormValues,
  TField,
  TTarget = TField,
>(
  form: FormController<TValues>,
  name: FormPath<TValues, TField>,
  target: Signal<TTarget>,
  options?: FormFieldBindingOptions<TField, TTarget>,
): () => void;
/** Binds form field state and returns a disposer for both subscriptions. */
export function bindFormField<TValues extends FormValues, TField, TTarget>(
  form: FormController<TValues>,
  name: FieldName<TValues> | FormPath<TValues, TField>,
  target: Signal<TTarget>,
  options: FormFieldBindingOptions<TField, TTarget> = {},
): () => void {
  const parse = options.parse ?? ((value: TTarget) => value as unknown as TField);
  const format = options.format ?? ((value: TField) => value as unknown as TTarget);
  const touchOnChange = options.touchOnChange ?? true;
  let syncing = false;

  const syncFromForm = () => {
    if (syncing) return;
    const value = form.getValue<TField>(name);
    if (value === undefined) return;
    const next = format(value);
    if (Object.is(target.peek(), next)) return;

    syncing = true;
    target.value = next;
    syncing = false;
  };

  const syncFromTarget = (value: TTarget) => {
    if (syncing) return;
    const next = parse(value);
    if (Object.is(form.getValue<TField>(name), next)) return;

    syncing = true;
    form.setValue(name, next);
    if (touchOnChange) form.touch(name);
    syncing = false;
  };

  if (options.initialSync === "target") {
    syncFromTarget(target.peek());
  } else {
    syncFromForm();
  }
  if (options.validateOnBind) form.validateField(name);

  target.subscribe(syncFromTarget);
  form.values.subscribe(syncFromForm);

  return () => {
    target.unsubscribe(syncFromTarget);
    form.values.unsubscribe(syncFromForm);
  };
}

/** Public helper for required. */
export function required(message = "Required"): FieldValidator<unknown> {
  return (value) => {
    if (value === undefined || value === null || value === "") return message;
    return undefined;
  };
}

/** Public helper for min Length. */
export function minLength(
  length: number,
  message: string = `Must be at least ${length} characters`,
): FieldValidator<unknown> {
  return (value) => {
    return typeof value === "string" && value.length < length ? message : undefined;
  };
}

function createFormRecord<TValue>(): Record<string, TValue> {
  return Object.create(null) as Record<string, TValue>;
}

function replaceFormRecord<TValue>(
  signal: Signal<Record<string, TValue>>,
  next: Record<string, TValue>,
): void {
  const current = signal.value;
  for (const key of Object.keys(current)) Reflect.deleteProperty(current, key);
  for (const key of Object.keys(next)) current[key] = next[key]!;
  signal.propagate();
}

function deleteFormRecordKey<TValue>(signal: Signal<Record<string, TValue>>, key: string): void {
  if (Reflect.deleteProperty(signal.value, key)) signal.propagate();
}

const DANGEROUS_REACTIVE_FORM_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const REACTIVE_ARRAY_MUTATORS = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

type ReactiveFormPathSegment = string | number;
interface PreparedReactiveFormMutation {
  readonly assertCurrent: () => void;
  readonly commit: (propagateValues?: boolean) => void;
}
type PrepareReactiveFormMutation<TValues extends FormValues> = (
  values: TValues,
  source: TValues,
) => PreparedReactiveFormMutation;

interface StagedReactiveFormMutation<TValues extends FormValues, TResult> {
  readonly nextValues: TValues;
  readonly target: Record<string, unknown> | unknown[];
  readonly result: TResult;
  readonly returnsTarget: boolean;
}

function createReactiveFormValues<TValues extends FormValues>(
  values: TValues,
  prepareMutation: PrepareReactiveFormMutation<TValues>,
): TValues {
  const proxies = new WeakMap<object, object>();
  const stageMutation = <TResult>(
    path: readonly ReactiveFormPathSegment[],
    mutate: (target: Record<string, unknown> | unknown[]) => TResult,
  ): StagedReactiveFormMutation<TValues, TResult> => {
    const stagedValues = cloneFormData(values, "$values:mutation-stage") as TValues;
    const stagedTarget = reactiveFormValueAtPath(stagedValues, path);
    const result = mutate(stagedTarget);
    const returnsTarget = result === stagedTarget;
    const nextValues = cloneFormData(stagedValues, "$values:mutation") as TValues;
    return {
      nextValues,
      target: reactiveFormValueAtPath(nextValues, path),
      result,
      returnsTarget,
    };
  };

  const wrap = (value: unknown, path: readonly ReactiveFormPathSegment[]): unknown => {
    if (!isReactiveFormContainer(value)) return value;
    const existing = proxies.get(value);
    if (existing) return existing;
    const arrayMutators = new Map<string, (...args: unknown[]) => unknown>();
    const proxy: Record<PropertyKey, unknown> | unknown[] = new Proxy(value, {
      get(target, property, receiver) {
        if (property === "__proto__") {
          throw new FormPathError("DANGEROUS_SEGMENT", "Prototype-sensitive property '__proto__' is not allowed");
        }
        if (Array.isArray(target) && typeof property === "string" && REACTIVE_ARRAY_MUTATORS.has(property)) {
          let mutator = arrayMutators.get(property);
          if (!mutator) {
            mutator = (...args: unknown[]): unknown => {
              const staged = stageMutation(path, (stagedTarget) => {
                if (!Array.isArray(stagedTarget)) {
                  throw new FormPathError("NON_CONTAINER", "An array mutation target is no longer an array");
                }
                const method = Reflect.get(Array.prototype, property);
                if (typeof method !== "function") {
                  throw new FormPathError("UNSUPPORTED_CONTAINER", `Unsupported array mutation '${property}'`);
                }
                return Reflect.apply(method, stagedTarget, args);
              });
              const nextArray = staged.target as unknown[];
              if (!formDataEquals(target, nextArray)) {
                const prepared = prepareMutation(staged.nextValues, rootProxy);
                prepared.assertCurrent();
                replaceReactiveArray(target, nextArray);
                prepared.commit();
              }
              return staged.returnsTarget ? proxy : staged.result;
            };
            arrayMutators.set(property, mutator);
          }
          return mutator;
        }
        const child = Reflect.get(target, property, receiver);
        const childSegment = reactiveChildPathSegment(target, property);
        return childSegment === undefined ? child : wrap(child, [...path, childSegment]);
      },
      set(target, property, next) {
        assertReactiveFormProperty(property);
        assertReactiveArrayAssignment(target, property, next);
        const descriptor = Object.getOwnPropertyDescriptor(target, property);
        const previous = descriptor && "value" in descriptor ? descriptor.value : undefined;
        const changed = !descriptor || !("value" in descriptor) || !Object.is(previous, next);
        if (!changed) return true;
        const staged = stageMutation(path, (stagedTarget) => {
          if (!Reflect.set(stagedTarget, property, next, stagedTarget)) {
            throw new FormPathError("ACCESS_FAILED", "A staged form value property could not be assigned");
          }
        });
        const safeDescriptor = Object.getOwnPropertyDescriptor(staged.target, property);
        if (!safeDescriptor || !("value" in safeDescriptor)) {
          throw new FormPathError("ACCESS_FAILED", "A staged form value property is missing");
        }
        const prepared = prepareMutation(staged.nextValues, rootProxy);
        prepared.assertCurrent();
        const assigned = Reflect.set(target, property, safeDescriptor.value, target);
        if (!assigned) throw new FormPathError("ACCESS_FAILED", "A form value property could not be assigned");
        prepared.commit();
        return assigned;
      },
      defineProperty(target, property, descriptor) {
        assertReactiveFormProperty(property);
        assertReactiveArrayProperty(target, property, false);
        if (
          !("value" in descriptor) || descriptor.configurable !== true || descriptor.enumerable !== true ||
          descriptor.writable !== true
        ) {
          throw new FormPathError(
            "UNSUPPORTED_CONTAINER",
            "Only configurable enumerable writable data properties are supported in form values",
          );
        }
        const previous = Object.getOwnPropertyDescriptor(target, property);
        const changed = !previous || !("value" in previous) || !Object.is(previous.value, descriptor.value);
        if (!changed) return true;
        const staged = stageMutation(path, (stagedTarget) => {
          Object.defineProperty(stagedTarget, property, descriptor);
        });
        const safeDescriptor = Object.getOwnPropertyDescriptor(staged.target, property);
        if (!safeDescriptor || !("value" in safeDescriptor)) {
          throw new FormPathError("ACCESS_FAILED", "A staged form value property is missing");
        }
        const prepared = prepareMutation(staged.nextValues, rootProxy);
        prepared.assertCurrent();
        const defined = Reflect.defineProperty(target, property, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: safeDescriptor.value,
        });
        if (!defined) throw new FormPathError("ACCESS_FAILED", "A form value property could not be defined");
        prepared.commit();
        return defined;
      },
      deleteProperty(target, property) {
        assertReactiveFormProperty(property);
        assertReactiveArrayProperty(target, property, false);
        const existed = Object.hasOwn(target, property);
        if (!existed) return true;
        const staged = stageMutation(path, (stagedTarget) => {
          if (!Reflect.deleteProperty(stagedTarget, property)) {
            throw new FormPathError("ACCESS_FAILED", "A staged form value property could not be deleted");
          }
        });
        const prepared = prepareMutation(staged.nextValues, rootProxy);
        prepared.assertCurrent();
        const deleted = Reflect.deleteProperty(target, property);
        if (!deleted) throw new FormPathError("ACCESS_FAILED", "A form value property could not be deleted");
        prepared.commit();
        return deleted;
      },
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (!descriptor || !("value" in descriptor) || !isReactiveFormContainer(descriptor.value)) {
          return descriptor;
        }
        const childSegment = reactiveChildPathSegment(target, property);
        if (childSegment === undefined) return descriptor;
        return {
          ...descriptor,
          value: wrap(descriptor.value, [...path, childSegment]),
        };
      },
      setPrototypeOf() {
        throw new FormPathError("DANGEROUS_SEGMENT", "Form value prototypes cannot be changed");
      },
      preventExtensions() {
        throw new FormPathError("UNSUPPORTED_CONTAINER", "Form value containers must remain extensible");
      },
    });
    proxies.set(value, proxy);
    return proxy;
  };
  const rootProxy = wrap(values, []) as TValues;
  return rootProxy;
}

function assertReactiveFormProperty(property: PropertyKey): asserts property is string {
  if (typeof property !== "string") {
    throw new FormPathError("UNSUPPORTED_CONTAINER", "Only string-keyed form values are supported");
  }
  if (DANGEROUS_REACTIVE_FORM_KEYS.has(property)) {
    throw new FormPathError("DANGEROUS_SEGMENT", `Prototype-sensitive property '${property}' is not allowed`);
  }
}

function assertReactiveArrayAssignment(target: object, property: string, value: unknown): void {
  assertReactiveArrayProperty(target, property, true);
  if (!Array.isArray(target) || property !== "length") return;
  if (
    typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 ||
    value > FORM_PATH_LIMITS.maxArrayIndex + 1
  ) {
    throw new FormPathError("INDEX_OUT_OF_RANGE", "A form array length assignment is outside configured bounds");
  }
}

function assertReactiveArrayProperty(target: object, property: string, allowLength: boolean): void {
  if (!Array.isArray(target)) return;
  if (property === "length") {
    if (allowLength) return;
    throw new FormPathError("UNSUPPORTED_CONTAINER", "A form array length cannot be defined or deleted directly");
  }
  if (reactiveArrayIndex(property) === undefined) {
    throw new FormPathError("UNSUPPORTED_CONTAINER", `Unsupported form array property '${property}'`);
  }
}

function reactiveArrayIndex(property: string): number | undefined {
  if (property === "0") return 0;
  if (property.length === 0 || property[0] === "0") return undefined;
  for (let index = 0; index < property.length; index += 1) {
    const code = property.charCodeAt(index);
    if (code < 48 || code > 57) return undefined;
  }
  const value = Number(property);
  return Number.isSafeInteger(value) && value >= 0 && value <= FORM_PATH_LIMITS.maxArrayIndex ? value : undefined;
}

function reactiveChildPathSegment(target: object, property: PropertyKey): ReactiveFormPathSegment | undefined {
  if (typeof property !== "string") return undefined;
  if (!Array.isArray(target)) return property;
  return reactiveArrayIndex(property);
}

function reactiveFormValueAtPath(
  values: unknown,
  path: readonly ReactiveFormPathSegment[],
): Record<string, unknown> | unknown[] {
  let current = values;
  for (let index = 0; index < path.length; index += 1) {
    if (typeof current !== "object" || current === null) {
      throw new FormPathError("NON_CONTAINER", "A reactive form mutation path is no longer traversable");
    }
    const segment = path[index]!;
    const descriptor = Object.getOwnPropertyDescriptor(current, String(segment));
    if (!descriptor || !("value" in descriptor)) {
      throw new FormPathError("MISSING_SEGMENT", "A reactive form mutation path no longer exists");
    }
    current = descriptor.value;
  }
  if (!isReactiveFormContainer(current)) {
    throw new FormPathError("NON_CONTAINER", "A reactive form mutation target is no longer a container");
  }
  return current;
}

function replaceReactiveArray(target: unknown[], next: unknown[]): void {
  if (!Reflect.set(target, "length", 0, target) || !Reflect.set(target, "length", next.length, target)) {
    throw new FormPathError("ACCESS_FAILED", "A form array length could not be replaced");
  }
  for (const key of Object.keys(next)) {
    const descriptor = Object.getOwnPropertyDescriptor(next, key);
    if (!descriptor || !("value" in descriptor)) continue;
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: descriptor.value,
    });
  }
}

function isReactiveFormContainer(value: unknown): value is Record<PropertyKey, unknown> | unknown[] {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formDataEquals(left: unknown, right: unknown): boolean {
  const clonedLeft = cloneFormData(left, "$dirty:left");
  const clonedRight = cloneFormData(right, "$dirty:right");
  return equalClonedFormData(clonedLeft, clonedRight);
}

function equalClonedFormData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== (right as unknown[]).length) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(rightRecord, key) || !equalClonedFormData(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function cloneRecord(record: Record<string, string[]>): Record<string, string[]> {
  const cloned = createFormRecord<string[]>();
  for (const [key, value] of ownDataEntries(record, "$record")) cloned[key] = value.slice();
  return cloned;
}

function cloneBooleanRecord(record: Record<string, boolean>, canonical: string): Record<string, boolean> {
  const cloned = createFormRecord<boolean>();
  for (const [key, value] of ownDataEntries(record, canonical)) cloned[key] = value;
  return cloned;
}

function isFormFieldArray<TValues extends FormValues>(
  value: readonly FormField<unknown, TValues>[] | FormControllerOptions<TValues>,
): value is readonly FormField<unknown, TValues>[] {
  return Array.isArray(value);
}

function schemaFields<TValues extends FormValues>(
  schema: FormSchemaAdapter<TValues> | undefined,
): readonly FormField<unknown, TValues>[] {
  if (!schema) return [];
  return typeof schema.fields === "function" ? schema.fields() : schema.fields;
}

function normalizeSchemaMessages(messages: readonly string[] | string | undefined): string[] {
  if (messages === undefined) return [];
  return typeof messages === "string" ? [messages] : messages.slice();
}

function resolveFieldState(state: FormFieldState | undefined): boolean {
  return typeof state === "function" ? state() : state ?? false;
}

function inspectFormGroups<TValues extends FormValues>(
  fields: readonly FormFieldInspection<TValues>[],
): Array<FormGroupInspection<TValues>> {
  const groups = new Map<string, Array<FormFieldInspection<TValues>>>();
  for (const field of fields) {
    const id = field.group ?? "default";
    let group = groups.get(id);
    if (!group) {
      group = [];
      groups.set(id, group);
    }
    group.push(field);
  }
  const inspected: Array<FormGroupInspection<TValues>> = [];
  for (const [id, groupFields] of groups) {
    const names: Array<FieldName<TValues>> = [];
    let valid = true;
    let dirty = false;
    let touched = false;
    let errorCount = 0;
    for (let index = 0; index < groupFields.length; index += 1) {
      const field = groupFields[index]!;
      names.push(field.name);
      valid = valid && field.valid;
      dirty = dirty || field.dirty;
      touched = touched || field.touched;
      errorCount += field.errors.length;
    }
    inspected.push({
      id,
      label: id === "default" ? "Default" : id,
      fields: names,
      valid,
      dirty,
      touched,
      errorCount,
    });
  }
  return inspected;
}

function appendMessages(existing: readonly string[], extra: readonly string[]): string[] {
  const messages = new Array<string>(existing.length + extra.length);
  let write = 0;
  for (let index = 0; index < existing.length; index += 1) messages[write++] = existing[index]!;
  for (let index = 0; index < extra.length; index += 1) messages[write++] = extra[index]!;
  return messages;
}

const DEFAULT_FORM_FIELD_ARRAY_ID_PROVIDER: FormFieldArrayIdProvider = ({ sequence }) => `item-${sequence}`;
const FORM_FIELD_ARRAY_OPTION_KEYS = new Set([
  "idProvider",
  "maxItems",
  "maxErrorsPerItem",
  "maxFieldMetadataEntries",
]);
const FORM_FIELD_ARRAY_METADATA_KEYS = new Set(["touched", "errors", "focused", "fieldMetadata"]);

function normalizeFormFieldArrayOptions(options: FormFieldArrayOptions): {
  readonly idProvider: FormFieldArrayIdProvider;
  readonly limits: NormalizedFormFieldArrayLimits;
} {
  const values = strictDataProperties(options, FORM_FIELD_ARRAY_OPTION_KEYS, "$field-array:options");
  const idProvider = values.get("idProvider") ?? DEFAULT_FORM_FIELD_ARRAY_ID_PROVIDER;
  if (typeof idProvider !== "function") {
    throw new FormPathError("INVALID_SEGMENT", "A field-array ID provider must be a function", "$field-array");
  }
  return {
    idProvider: idProvider as FormFieldArrayIdProvider,
    limits: Object.freeze({
      maxItems: boundedFieldArrayOption(
        values.get("maxItems"),
        FORM_FIELD_ARRAY_LIMITS.maxItems,
        FORM_FIELD_ARRAY_LIMITS.maxItems,
        "maxItems",
      ),
      maxErrorsPerItem: boundedFieldArrayOption(
        values.get("maxErrorsPerItem"),
        FORM_FIELD_ARRAY_LIMITS.maxErrorsPerItem,
        FORM_FIELD_ARRAY_LIMITS.maxErrorsPerItem,
        "maxErrorsPerItem",
      ),
      maxFieldMetadataEntries: boundedFieldArrayOption(
        values.get("maxFieldMetadataEntries"),
        FORM_FIELD_ARRAY_LIMITS.maxFieldMetadataEntries,
        FORM_FIELD_ARRAY_LIMITS.maxFieldMetadataEntries,
        "maxFieldMetadataEntries",
      ),
    }),
  };
}

function boundedFieldArrayOption(value: unknown, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new FormPathError(
      "WIDTH_LIMIT",
      `Field-array option '${name}' must be a positive integer within its configured bound`,
      "$field-array",
    );
  }
  return value;
}

function strictDataProperties(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
): Map<string, unknown> {
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new FormPathError("UNSUPPORTED_CONTAINER", "Expected a plain data options object", path);
    }
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch (error) {
    if (error instanceof FormPathError) throw error;
    throw new FormPathError("ACCESS_FAILED", "A field-array options object could not be inspected", path);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new FormPathError("UNSUPPORTED_CONTAINER", "Expected a plain data options object", path);
  }
  const properties = new Map<string, unknown>();
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.has(key)) {
      throw new FormPathError("INVALID_SEGMENT", "A field-array options object contains an unknown key", path);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new FormPathError("ACCESS_FAILED", "A field-array option could not be inspected", path);
    }
    if (!descriptor || !("value" in descriptor)) {
      throw new FormPathError("ACCESSOR_PROPERTY", "Field-array options cannot contain accessors", path);
    }
    properties.set(key, descriptor.value);
  }
  return properties;
}

function cloneDenseFieldArray<TItem>(value: unknown, maxItems: number, path: string): TItem[] {
  const cloned = cloneFormData(value, "$field-array:values");
  if (!Array.isArray(cloned)) {
    throw new FormPathError("NON_CONTAINER", "A field-array path must contain an array", path);
  }
  if (cloned.length > maxItems) {
    throw new FormPathError("ENTRY_LIMIT", "A field array exceeds its configured item bound", path);
  }
  assertCloneSafeFieldArrayData(cloned, path);
  const items = new Array<TItem>(cloned.length);
  for (let index = 0; index < cloned.length; index += 1) {
    if (!Object.hasOwn(cloned, index)) {
      throw new FormPathError("UNSUPPORTED_CONTAINER", "Sparse field arrays are not supported", path);
    }
    items[index] = deepFreezeFormValue(cloned[index]) as TItem;
  }
  return items;
}

function cloneAndFreezeFormValue(value: unknown, path: string): unknown {
  const cloned = cloneFormData(value, path);
  assertCloneSafeFieldArrayData(cloned, path);
  return deepFreezeFormValue(cloned);
}

function assertCloneSafeFieldArrayData(
  value: unknown,
  path: string,
  seen = new WeakSet<object>(),
): void {
  if (typeof value === "symbol") {
    throw new FormPathError(
      "UNSUPPORTED_CONTAINER",
      "Symbol values are not supported in clone-safe field-array data",
      path,
    );
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      assertCloneSafeFieldArrayData(descriptor.value, path, seen);
    }
  }
}

function deepFreezeFormValue<TValue>(value: TValue, seen = new WeakSet<object>()): TValue {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) deepFreezeFormValue(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function validateFieldArrayId(value: unknown, path: string): FormFieldArrayItemId {
  if (typeof value !== "string" || value.length === 0) {
    throw new FormPathError("INVALID_SEGMENT", "A field-array identity must be a non-empty string", path);
  }
  if (value.length > FORM_FIELD_ARRAY_LIMITS.maxIdLength) {
    throw new FormPathError("WIDTH_LIMIT", "A field-array identity exceeds its configured length bound", path);
  }
  return value as FormFieldArrayItemId;
}

function emptyOwnedFieldArrayMetadata(): FormFieldArrayItemMetadata {
  return ownedFieldArrayMetadata({
    touched: false,
    errors: [],
    focused: false,
    fieldMetadata: Object.create(null) as Record<string, unknown>,
  });
}

function ownedFieldArrayMetadata(metadata: FormFieldArrayItemMetadata): FormFieldArrayItemMetadata {
  return Object.freeze({
    touched: metadata.touched,
    errors: Object.freeze(metadata.errors.slice()),
    focused: metadata.focused,
    fieldMetadata: cloneAndFreezeFormValue(
      metadata.fieldMetadata,
      "$field-array:metadata",
    ) as Record<string, unknown>,
  });
}

function normalizeFieldArrayMetadataPatch(
  patch: FormFieldArrayItemMetadataPatch,
  current: FormFieldArrayItemMetadata | undefined,
  limits: NormalizedFormFieldArrayLimits,
  path: string,
): FormFieldArrayItemMetadata {
  const values = strictDataProperties(patch, FORM_FIELD_ARRAY_METADATA_KEYS, "$field-array:metadata-patch");
  const touched = values.has("touched") ? values.get("touched") : current?.touched ?? false;
  const focused = values.has("focused") ? values.get("focused") : current?.focused ?? false;
  if (typeof touched !== "boolean" || typeof focused !== "boolean") {
    throw new FormPathError("INVALID_SEGMENT", "Field-array touched and focused state must be boolean", path);
  }
  const errors = values.has("errors")
    ? normalizeFieldArrayErrors(values.get("errors"), limits.maxErrorsPerItem, path)
    : current?.errors ?? [];
  const fieldMetadata = values.has("fieldMetadata")
    ? normalizeFieldArrayFieldMetadata(values.get("fieldMetadata"), limits.maxFieldMetadataEntries, path)
    : current?.fieldMetadata ?? (Object.create(null) as Record<string, unknown>);
  return ownedFieldArrayMetadata({ touched, errors, focused, fieldMetadata });
}

function normalizeFieldArrayErrors(value: unknown, maxErrors: number, path: string): readonly string[] {
  const cloned = cloneFormData(value, "$field-array:errors");
  if (!Array.isArray(cloned)) {
    throw new FormPathError("NON_CONTAINER", "Field-array errors must be an array of strings", path);
  }
  if (cloned.length > maxErrors) {
    throw new FormPathError("ENTRY_LIMIT", "Field-array errors exceed their configured item bound", path);
  }
  const errors = new Array<string>(cloned.length);
  for (let index = 0; index < cloned.length; index += 1) {
    if (!Object.hasOwn(cloned, index) || typeof cloned[index] !== "string") {
      throw new FormPathError("INVALID_SEGMENT", "Field-array errors must be dense strings", path);
    }
    if ((cloned[index] as string).length > FORM_FIELD_ARRAY_LIMITS.maxErrorLength) {
      throw new FormPathError("WIDTH_LIMIT", "A field-array error exceeds its configured length bound", path);
    }
    errors[index] = cloned[index] as string;
  }
  return Object.freeze(errors);
}

function normalizeFieldArrayFieldMetadata(
  value: unknown,
  maxEntries: number,
  path: string,
): Readonly<Record<string, unknown>> {
  const cloned = cloneFormData(value, "$field-array:field-metadata");
  if (typeof cloned !== "object" || cloned === null || Array.isArray(cloned)) {
    throw new FormPathError("NON_CONTAINER", "Field-array field metadata must be a plain object", path);
  }
  const keys = Object.keys(cloned);
  if (keys.length > maxEntries) {
    throw new FormPathError("ENTRY_LIMIT", "Field-array field metadata exceeds its configured entry bound", path);
  }
  for (const key of keys) {
    if (key.length > FORM_FIELD_ARRAY_LIMITS.maxFieldMetadataKeyLength) {
      throw new FormPathError("WIDTH_LIMIT", "A field-array metadata key exceeds its configured length bound", path);
    }
  }
  assertCloneSafeFieldArrayData(cloned, path);
  return deepFreezeFormValue(cloned as Record<string, unknown>);
}

function ownedFieldArrayItem<TItem>(
  id: FormFieldArrayItemId,
  value: TItem,
  metadata: FormFieldArrayItemMetadata,
): OwnedFormFieldArrayItem<TItem> {
  return Object.freeze({ id, value, metadata });
}

function ownedFieldArrayState<TItem>(
  sequence: number,
  items: readonly OwnedFormFieldArrayItem<TItem>[],
): OwnedFormFieldArrayState<TItem> {
  return Object.freeze({ sequence, items: Object.freeze(items.slice()) });
}

function cloneOwnedFieldArrayState<TItem>(state: OwnedFormFieldArrayState<TItem>): OwnedFormFieldArrayState<TItem> {
  return ownedFieldArrayState(
    state.sequence,
    state.items.map((item) =>
      ownedFieldArrayItem(
        item.id,
        cloneAndFreezeFormValue(item.value, "$field-array:state") as TItem,
        ownedFieldArrayMetadata(item.metadata),
      )
    ),
  );
}

function inspectOwnedFieldArrayItem<TItem>(
  item: OwnedFormFieldArrayItem<TItem>,
): FormFieldArrayItemInspection<TItem> {
  return Object.freeze({
    id: item.id,
    value: cloneAndFreezeFormValue(item.value, "$field-array:inspection") as TItem,
    touched: item.metadata.touched,
    errors: Object.freeze(item.metadata.errors.slice()),
    focused: item.metadata.focused,
    fieldMetadata: cloneAndFreezeFormValue(
      item.metadata.fieldMetadata,
      "$field-array:inspection-metadata",
    ) as Record<string, unknown>,
  });
}

function inspectOwnedFieldArrayState<TItem>(
  state: OwnedFormFieldArrayState<TItem>,
  path: string,
  revision: number,
): FormFieldArrayInspection<TItem> {
  const items = Object.freeze(state.items.map(inspectOwnedFieldArrayItem));
  return Object.freeze({ path, revision, length: items.length, items });
}

function assertOwnedFieldArrayState<TItem>(
  state: OwnedFormFieldArrayState<TItem>,
  limits: NormalizedFormFieldArrayLimits,
  path: string,
): void {
  if (!Number.isSafeInteger(state.sequence) || state.sequence < 0) {
    throw new FormPathError("WIDTH_LIMIT", "A field-array identity sequence is invalid", path);
  }
  if (state.items.length > limits.maxItems) {
    throw new FormPathError("ENTRY_LIMIT", "A field array exceeds its configured item bound", path);
  }
  const ids = new Set<string>();
  let focused = 0;
  for (const item of state.items) {
    validateFieldArrayId(item.id, path);
    if (ids.has(item.id)) {
      throw new FormPathError("IDENTITY_COLLISION", "A field array contains duplicate stable identities", path);
    }
    ids.add(item.id);
    if (item.metadata.focused) focused += 1;
  }
  if (focused > 1) {
    throw new FormPathError("IDENTITY_COLLISION", "A field array cannot focus more than one item", path);
  }
}

function ownedFieldArrayStatesEqual<TItem>(
  left: OwnedFormFieldArrayState<TItem>,
  right: OwnedFormFieldArrayState<TItem>,
): boolean {
  if (left.sequence !== right.sequence || left.items.length !== right.items.length) return false;
  for (let index = 0; index < left.items.length; index += 1) {
    const leftItem = left.items[index]!;
    const rightItem = right.items[index]!;
    if (
      leftItem.id !== rightItem.id || !equalClonedFormData(leftItem.value, rightItem.value) ||
      !fieldArrayMetadataEquals(leftItem.metadata, rightItem.metadata)
    ) return false;
  }
  return true;
}

function ownedFieldArrayItemsEqual<TItem>(
  left: OwnedFormFieldArrayState<TItem>,
  right: OwnedFormFieldArrayState<TItem>,
): boolean {
  if (left.items.length !== right.items.length) return false;
  for (let index = 0; index < left.items.length; index += 1) {
    const leftItem = left.items[index]!;
    const rightItem = right.items[index]!;
    if (
      leftItem.id !== rightItem.id || !equalClonedFormData(leftItem.value, rightItem.value) ||
      !fieldArrayMetadataEquals(leftItem.metadata, rightItem.metadata)
    ) return false;
  }
  return true;
}

function ownedFieldArrayValuesEqual<TItem>(
  left: readonly OwnedFormFieldArrayItem<TItem>[],
  right: readonly OwnedFormFieldArrayItem<TItem>[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!equalClonedFormData(left[index]!.value, right[index]!.value)) return false;
  }
  return true;
}

function fieldArrayValuesEqualItems<TItem>(
  values: readonly TItem[],
  items: readonly OwnedFormFieldArrayItem<TItem>[],
): boolean {
  if (values.length !== items.length) return false;
  for (let index = 0; index < values.length; index += 1) {
    if (!equalClonedFormData(values[index], items[index]!.value)) return false;
  }
  return true;
}

interface FormFieldArrayFingerprintContext {
  readonly active: WeakSet<object>;
  readonly memo: WeakMap<object, string>;
}

function createFormFieldArrayFingerprintContext(): FormFieldArrayFingerprintContext {
  return {
    active: new WeakSet<object>(),
    memo: new WeakMap<object, string>(),
  };
}

function formFieldArrayValueFingerprint(
  value: unknown,
  context: FormFieldArrayFingerprintContext = createFormFieldArrayFingerprintContext(),
): string {
  return fingerprintFormFieldArrayValue(value, context);
}

function fingerprintFormFieldArrayValue(value: unknown, context: FormFieldArrayFingerprintContext): string {
  if (value === null) return hashFormFieldArrayFingerprint(["null"]);
  switch (typeof value) {
    case "undefined":
      return hashFormFieldArrayFingerprint(["undefined"]);
    case "boolean":
      return hashFormFieldArrayFingerprint(["boolean", value ? "true" : "false"]);
    case "number":
      return hashFormFieldArrayFingerprint(["number", normalizedFieldArrayNumber(value)]);
    case "bigint":
      return hashFormFieldArrayFingerprint(["bigint", value.toString()]);
    case "string":
      return hashFormFieldArrayFingerprint(["string", value]);
    case "symbol":
      throw new FormPathError(
        "UNSUPPORTED_CONTAINER",
        "Symbols cannot participate in clone-safe field-array reconciliation",
        "$field-array",
      );
    case "function":
      throw new FormPathError(
        "UNSUPPORTED_CONTAINER",
        "Functions cannot participate in field-array reconciliation",
        "$field-array",
      );
    case "object": {
      const existing = context.memo.get(value);
      if (existing) return existing;
      if (context.active.has(value)) {
        throw new FormPathError("CYCLE", "Cyclic field-array values cannot be reconciled", "$field-array");
      }
      context.active.add(value);
      try {
        const array = Array.isArray(value);
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        const parts = [
          array ? "array" : "object",
          array ? String((value as unknown[]).length) : "",
          String(keys.length),
        ];
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(record, key);
          if (!descriptor || !("value" in descriptor)) {
            throw new FormPathError(
              "ACCESSOR_PROPERTY",
              "Field-array reconciliation requires own data properties",
              "$field-array",
            );
          }
          parts.push(key, fingerprintFormFieldArrayValue(descriptor.value, context));
        }
        const fingerprint = hashFormFieldArrayFingerprint(parts);
        context.memo.set(value, fingerprint);
        return fingerprint;
      } finally {
        context.active.delete(value);
      }
    }
  }
  throw new FormPathError("UNSUPPORTED_CONTAINER", "Unsupported field-array value type", "$field-array");
}

function normalizedFieldArrayNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (Object.is(value, -0)) return "-0";
  if (value === Number.POSITIVE_INFINITY) return "+Infinity";
  if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
  return String(value);
}

function hashFormFieldArrayFingerprint(parts: readonly string[]): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let units = 0;
  const update = (code: number) => {
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x5bd1e995);
    second ^= second >>> 13;
    units += 1;
  };
  for (const part of parts) {
    const length = String(part.length);
    for (let index = 0; index < length.length; index += 1) update(length.charCodeAt(index));
    update(0x3a);
    for (let index = 0; index < part.length; index += 1) update(part.charCodeAt(index));
    update(0x1f);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}:${(second >>> 0).toString(16).padStart(8, "0")}:${units}`;
}

function fieldArrayMetadataEquals(left: FormFieldArrayItemMetadata, right: FormFieldArrayItemMetadata): boolean {
  if (left.touched !== right.touched || left.focused !== right.focused || left.errors.length !== right.errors.length) {
    return false;
  }
  for (let index = 0; index < left.errors.length; index += 1) {
    if (left.errors[index] !== right.errors[index]) return false;
  }
  return equalClonedFormData(left.fieldMetadata, right.fieldMetadata);
}

function sameOwnedFieldArrayItems<TItem>(
  left: readonly OwnedFormFieldArrayItem<TItem>[],
  right: readonly OwnedFormFieldArrayItem<TItem>[],
): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function clearFocusedFieldArrayItems<TItem>(
  items: OwnedFormFieldArrayItem<TItem>[],
  exceptId?: FormFieldArrayItemId,
): void {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (!item.metadata.focused || item.id === exceptId) continue;
    items[index] = ownedFieldArrayItem(
      item.id,
      item.value,
      ownedFieldArrayMetadata({ ...item.metadata, focused: false }),
    );
  }
}

function findRequiredFieldArrayItem<TItem>(
  state: OwnedFormFieldArrayState<TItem>,
  id: FormFieldArrayItemId,
  path: string,
): number {
  const normalized = validateFieldArrayId(id, path);
  const index = state.items.findIndex((item) => item.id === normalized);
  if (index < 0) {
    throw new FormPathError("MISSING_SEGMENT", "A field-array item identity does not exist", path);
  }
  return index;
}

function assertFieldArrayCapacity(length: number, maximum: number, path: string): void {
  if (length >= maximum) {
    throw new FormPathError("ENTRY_LIMIT", "A field array reached its configured item bound", path);
  }
}

function assertFieldArrayInsertIndex(index: number, length: number, path: string): void {
  if (!Number.isSafeInteger(index) || index < 0 || index > length) {
    throw new FormPathError("INDEX_OUT_OF_RANGE", "A field-array insertion index is outside current bounds", path);
  }
}

function assertFieldArrayReadIndex(index: number, length: number, allowEnd: boolean, path: string): void {
  const maximum = allowEnd ? length : length - 1;
  if (!Number.isSafeInteger(index) || index < 0 || index > maximum) {
    throw new FormPathError("INDEX_OUT_OF_RANGE", "A field-array index is outside current bounds", path);
  }
}

function readDuplicateInteractionOption(options: FormFieldArrayDuplicateOptions): boolean {
  const values = strictDataProperties(
    options,
    new Set(["copyInteractionState"]),
    "$field-array:duplicate-options",
  );
  const value = values.get("copyInteractionState") ?? false;
  if (typeof value !== "boolean") {
    throw new FormPathError(
      "INVALID_SEGMENT",
      "Field-array duplicate copyInteractionState must be boolean",
      "$field-array",
    );
  }
  return value;
}

function normalizeFieldArrayHistoryOptions(
  options: FormFieldArrayHistoryOptions,
  operation: FormFieldArrayOperation,
): { readonly id?: string; readonly label: string; readonly group?: string } {
  const values = strictDataProperties(options, new Set(["id", "label", "group"]), "$field-array:history-options");
  const id = normalizedOptionalFieldArrayText(values.get("id"), "id");
  const group = normalizedOptionalFieldArrayText(values.get("group"), "group");
  const suppliedLabel = normalizedOptionalFieldArrayText(values.get("label"), "label");
  const result: { id?: string; label: string; group?: string } = {
    label: suppliedLabel ?? defaultFieldArrayHistoryLabel(operation),
  };
  if (id !== undefined) result.id = id;
  if (group !== undefined) result.group = group;
  return result;
}

function normalizedOptionalFieldArrayText(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new FormPathError("INVALID_SEGMENT", `Field-array history ${name} must be a string`, "$field-array");
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new FormPathError("INVALID_SEGMENT", `Field-array history ${name} cannot be empty`, "$field-array");
  }
  if (normalized.length > FORM_PATH_LIMITS.maxSegmentLength) {
    throw new FormPathError("WIDTH_LIMIT", `Field-array history ${name} exceeds its length bound`, "$field-array");
  }
  return normalized;
}

function defaultFieldArrayHistoryLabel(operation: FormFieldArrayOperation): string {
  switch (operation) {
    case "insert":
      return "Insert form item";
    case "remove":
      return "Remove form item";
    case "move":
      return "Move form item";
    case "duplicate":
      return "Duplicate form item";
    case "reset":
      return "Reset form items";
    case "set-value":
      return "Update form item";
    case "set-metadata":
      return "Update form item metadata";
    case "touch":
      return "Touch form item";
    case "set-errors":
      return "Validate form item";
    case "focus":
      return "Focus form item";
  }
}
