// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { DisposableStack } from "./disposables.ts";

/** Public type alias for a form Values. */
export type FormValues = object;
/** Public type alias for a field Name. */
export type FieldName<TValues extends FormValues> = keyof TValues & string;
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
  name: FieldName<TValues>;
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

/** State controller for form behavior. */
export class FormController<TValues extends FormValues = FormValues> {
  readonly values: Signal<TValues>;
  readonly errors = new Signal<Record<string, string[]>>({}, { deepObserve: true });
  readonly touched = new Signal<Record<string, boolean>>({}, { deepObserve: true });
  readonly dirty = new Signal<Record<string, boolean>>({}, { deepObserve: true });

  private readonly fields = new Map<FieldName<TValues>, FormField<unknown, TValues>>();
  private readonly initialValues: TValues;
  private readonly schema?: FormSchemaAdapter<TValues>;

  constructor(fieldsOrOptions: readonly FormField<unknown, TValues>[] | FormControllerOptions<TValues> = []) {
    const options: FormControllerOptions<TValues> = isFormFieldArray(fieldsOrOptions)
      ? { fields: fieldsOrOptions }
      : fieldsOrOptions;
    this.initialValues = {} as TValues;
    this.values = new Signal<TValues>({} as TValues, { deepObserve: true, watchObjectIndex: true } as never);
    this.schema = options.schema;
    for (const field of [...schemaFields(options.schema), ...(options.fields ?? [])]) {
      this.register(field);
    }
  }

  register<TValue>(field: FormField<TValue, TValues>): () => void {
    const registered = field as FormField<unknown, TValues>;
    this.fields.set(field.name, registered);
    this.mutableInitialValues()[field.name] = field.initialValue;
    this.mutableValues()[field.name] = field.initialValue;
    this.errors.value[field.name] ??= [];
    this.touched.value[field.name] ??= false;
    this.dirty.value[field.name] ??= false;
    return () => {
      if (this.fields.get(field.name) === registered) {
        this.unregister(field.name);
      }
    };
  }

  registerAll(fields: Iterable<FormField<unknown, TValues>>): () => void {
    const stack = new DisposableStack();
    try {
      for (const field of fields) {
        stack.defer(this.register(field));
      }
    } catch (error) {
      stack.dispose();
      throw error;
    }

    return stack.dispose;
  }

  unregister(name: FieldName<TValues>): void {
    this.fields.delete(name);
    delete this.mutableValues()[name];
    delete this.errors.value[name];
    delete this.touched.value[name];
    delete this.dirty.value[name];
    delete this.mutableInitialValues()[name];
  }

  setValue<TName extends FieldName<TValues>>(name: TName, value: TValues[TName]): boolean {
    if (!this.canEditField(name)) return false;
    this.mutableValues()[name] = value;
    this.dirty.value[name] = value !== this.initialValue(name);
    this.validateField(name);
    return true;
  }

  getValue<TValue = unknown>(name: FieldName<TValues>): TValue | undefined {
    return this.values.peek()[name] as TValue | undefined;
  }

  touch(name: FieldName<TValues>): void {
    this.touched.value[name] = true;
  }

  touchAll(): void {
    for (const name of this.fields.keys()) {
      this.touch(name);
    }
  }

  validateField(name: FieldName<TValues>): boolean {
    const field = this.fields.get(name);
    if (!field) return true;
    if (this.isFieldDisabled(name)) {
      this.errors.value[name] = [];
      return true;
    }
    const value = this.values.peek()[name];
    const validators = field.validators ?? [];
    const errors: string[] = [];
    for (let index = 0; index < validators.length; index += 1) {
      const message = validators[index]!(value, this.values.peek());
      if (message) errors.push(message);
    }
    this.errors.value[name] = errors;
    return errors.length === 0;
  }

  validate(): boolean {
    let valid = true;
    for (const name of this.fields.keys()) {
      valid = this.validateField(name) && valid;
    }
    const schemaErrors = (this.schema?.validate?.(this.values.peek()) ?? {}) as Record<
      string,
      readonly string[] | string | undefined
    >;
    for (const name in schemaErrors) {
      const messages = schemaErrors[name];
      if (!this.fields.has(name as FieldName<TValues>) || this.isFieldDisabled(name as FieldName<TValues>)) continue;
      const normalized = normalizeSchemaMessages(messages);
      this.errors.value[name] = appendMessages(this.errors.peek()[name] ?? [], normalized);
      valid = normalized.length === 0 && valid;
    }
    return valid;
  }

  isValid(): boolean {
    const errors = this.errors.peek();
    for (const name in errors) {
      if (errors[name]!.length > 0) return false;
    }
    return true;
  }

  isDirty(): boolean {
    const dirty = this.dirty.peek();
    for (const name in dirty) {
      if (dirty[name]) return true;
    }
    return false;
  }

  isTouched(): boolean {
    const touched = this.touched.peek();
    for (const name in touched) {
      if (touched[name]) return true;
    }
    return false;
  }

  fieldNames(): Array<FieldName<TValues>> {
    const names: Array<FieldName<TValues>> = [];
    for (const name of this.fields.keys()) names.push(name);
    return names;
  }

  field(name: FieldName<TValues>): FormField<unknown, TValues> | undefined {
    const field = this.fields.get(name);
    return field ? { ...field } : undefined;
  }

  setFieldDisabled(name: FieldName<TValues>, disabled: FormFieldState): boolean {
    return this.updateFieldState(name, { disabled });
  }

  setFieldReadOnly(name: FieldName<TValues>, readOnly: FormFieldState): boolean {
    return this.updateFieldState(name, { readOnly });
  }

  isFieldDisabled(name: FieldName<TValues>): boolean {
    return resolveFieldState(this.fields.get(name)?.disabled);
  }

  isFieldReadOnly(name: FieldName<TValues>): boolean {
    return resolveFieldState(this.fields.get(name)?.readOnly);
  }

  canEditField(name: FieldName<TValues>): boolean {
    return this.fields.has(name) && !this.isFieldDisabled(name) && !this.isFieldReadOnly(name);
  }

  canSubmit(): boolean {
    for (const name of this.fields.keys()) {
      if (!this.isFieldDisabled(name)) return true;
    }
    return false;
  }

  setValues(values: Partial<TValues>): void {
    const record = values as Record<string, TValues[FieldName<TValues>]>;
    for (const name in record) {
      if (this.fields.has(name as FieldName<TValues>)) {
        this.setValue(name as FieldName<TValues>, record[name]!);
      }
    }
  }

  reset(values: Partial<TValues> = {}): void {
    for (const [name, field] of this.fields) {
      const value = name in values ? (values as Record<string, unknown>)[name] : this.initialValue(name);
      this.mutableValues()[name] = value ?? field.initialValue;
      this.errors.value[name] = [];
      this.touched.value[name] = false;
      this.dirty.value[name] = false;
    }
  }

  async submit(
    onSubmit?: (snapshot: FormSnapshot<TValues>) => void | Promise<void>,
  ): Promise<FormSubmitResult<TValues>> {
    this.touchAll();
    const valid = this.validate();
    const snapshot = this.snapshot();
    const submitted = valid && this.canSubmit();
    if (submitted) await onSubmit?.(snapshot);
    return { valid, submitted, snapshot };
  }

  snapshot(): FormSnapshot<TValues> {
    return {
      values: { ...this.values.peek() },
      errors: cloneRecord(this.errors.peek()),
      touched: { ...this.touched.peek() },
      dirty: { ...this.dirty.peek() },
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
    for (const name of this.fields.keys()) {
      const errors = snapshot.errors[name] ?? [];
      const field = this.fields.get(name);
      const touched = snapshot.touched[name] ?? false;
      const dirty = snapshot.dirty[name] ?? false;
      const disabled = this.isFieldDisabled(name);
      const readOnly = this.isFieldReadOnly(name);
      const valid = errors.length === 0;
      const inspection: FormFieldInspection<TValues> = {
        name,
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
        const item: FormErrorSummaryItem<TValues> = { name: inspection.name, errors: cloneStringArray(errors) };
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
    this.fields.clear();
    for (const key in this.initialValues) {
      delete this.mutableInitialValues()[key];
    }
    this.values.dispose();
    this.errors.dispose();
    this.touched.dispose();
    this.dirty.dispose();
  }

  private mutableValues(): Record<string, unknown> {
    return this.values.value as Record<string, unknown>;
  }

  private mutableInitialValues(): Record<string, unknown> {
    return this.initialValues as Record<string, unknown>;
  }

  private initialValue(name: FieldName<TValues>): unknown {
    return (this.initialValues as Record<string, unknown>)[name];
  }

  private updateFieldState(
    name: FieldName<TValues>,
    patch: Pick<Partial<FormField<unknown, TValues>>, "disabled" | "readOnly">,
  ): boolean {
    const field = this.fields.get(name);
    if (!field) return false;
    this.fields.set(name, { ...field, ...patch });
    if (patch.disabled !== undefined && this.isFieldDisabled(name)) this.errors.value[name] = [];
    return true;
  }
}

/** Binds form Field behavior and returns a disposer when applicable. */
export function bindFormField<
  TValues extends FormValues,
  TName extends FieldName<TValues>,
  TTarget = TValues[TName],
>(
  form: FormController<TValues>,
  name: TName,
  target: Signal<TTarget>,
  options: FormFieldBindingOptions<TValues[TName], TTarget> = {},
): () => void {
  const parse = options.parse ?? ((value: TTarget) => value as unknown as TValues[TName]);
  const format = options.format ?? ((value: TValues[TName]) => value as unknown as TTarget);
  const touchOnChange = options.touchOnChange ?? true;
  let syncing = false;

  const syncFromForm = () => {
    if (syncing) return;
    const value = form.getValue<TValues[TName]>(name);
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
    if (Object.is(form.getValue<TValues[TName]>(name), next)) return;

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
export function minLength(length: number, message = `Must be at least ${length} characters`): FieldValidator<unknown> {
  return (value) => {
    return typeof value === "string" && value.length < length ? message : undefined;
  };
}

function cloneRecord(record: Record<string, string[]>): Record<string, string[]> {
  const cloned: Record<string, string[]> = {};
  for (const key in record) cloned[key] = cloneStringArray(record[key] ?? []);
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
  return typeof messages === "string" ? [messages] : cloneStringArray(messages);
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

function cloneStringArray(values: readonly string[]): string[] {
  const cloned = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) cloned[index] = values[index]!;
  return cloned;
}

function appendMessages(existing: readonly string[], extra: readonly string[]): string[] {
  const messages = new Array<string>(existing.length + extra.length);
  let write = 0;
  for (let index = 0; index < existing.length; index += 1) messages[write++] = existing[index]!;
  for (let index = 0; index < extra.length; index += 1) messages[write++] = extra[index]!;
  return messages;
}
