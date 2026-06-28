// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { DisposableStack } from "./disposables.ts";

export type FormValues = object;
export type FieldName<TValues extends FormValues> = keyof TValues & string;
export type FieldValidator<TValue = unknown, TValues extends FormValues = FormValues> = (
  value: TValue,
  values: TValues,
) => string | undefined;

export interface FormField<TValue = unknown, TValues extends FormValues = FormValues> {
  name: FieldName<TValues>;
  initialValue: TValue;
  validators?: readonly FieldValidator<TValue, TValues>[];
}

export interface FormSnapshot<TValues extends FormValues = FormValues> {
  values: TValues;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  valid: boolean;
}

export interface FormFieldInspection<TValues extends FormValues = FormValues> {
  name: FieldName<TValues>;
  touched: boolean;
  dirty: boolean;
  errors: string[];
  valid: boolean;
}

export interface FormInspection<TValues extends FormValues = FormValues> extends FormSnapshot<TValues> {
  fields: Array<FormFieldInspection<TValues>>;
  fieldCount: number;
  touchedFields: string[];
  dirtyFields: string[];
  errorFields: string[];
  dirtyForm: boolean;
  touchedForm: boolean;
}

export class FormController<TValues extends FormValues = FormValues> {
  readonly values: Signal<TValues>;
  readonly errors = new Signal<Record<string, string[]>>({}, { deepObserve: true });
  readonly touched = new Signal<Record<string, boolean>>({}, { deepObserve: true });
  readonly dirty = new Signal<Record<string, boolean>>({}, { deepObserve: true });

  private readonly fields = new Map<FieldName<TValues>, FormField<unknown, TValues>>();
  private readonly initialValues: TValues;

  constructor(fields: readonly FormField<unknown, TValues>[] = []) {
    this.initialValues = {} as TValues;
    this.values = new Signal<TValues>({} as TValues, { deepObserve: true, watchObjectIndex: true } as never);
    for (const field of fields) {
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

  setValue<TName extends FieldName<TValues>>(name: TName, value: TValues[TName]): void {
    this.mutableValues()[name] = value;
    this.dirty.value[name] = value !== this.initialValue(name);
    this.validateField(name);
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
    const value = this.values.peek()[name];
    const errors = (field.validators ?? [])
      .map((validator) => validator(value, this.values.peek()))
      .filter((message): message is string => !!message);
    this.errors.value[name] = errors;
    return errors.length === 0;
  }

  validate(): boolean {
    let valid = true;
    for (const name of this.fields.keys()) {
      valid = this.validateField(name) && valid;
    }
    return valid;
  }

  isValid(): boolean {
    return Object.values(this.errors.peek()).every((messages) => messages.length === 0);
  }

  isDirty(): boolean {
    return Object.values(this.dirty.peek()).some(Boolean);
  }

  isTouched(): boolean {
    return Object.values(this.touched.peek()).some(Boolean);
  }

  fieldNames(): Array<FieldName<TValues>> {
    return [...this.fields.keys()];
  }

  setValues(values: Partial<TValues>): void {
    for (const [name, value] of Object.entries(values)) {
      if (this.fields.has(name as FieldName<TValues>)) {
        this.setValue(name as FieldName<TValues>, value as TValues[FieldName<TValues>]);
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
    const fields = this.fieldNames().map((name) => {
      const errors = snapshot.errors[name] ?? [];
      return {
        name,
        touched: snapshot.touched[name] ?? false,
        dirty: snapshot.dirty[name] ?? false,
        errors,
        valid: errors.length === 0,
      };
    });
    return {
      ...snapshot,
      fields,
      fieldCount: fields.length,
      touchedFields: fields.filter((field) => field.touched).map((field) => field.name),
      dirtyFields: fields.filter((field) => field.dirty).map((field) => field.name),
      errorFields: fields.filter((field) => !field.valid).map((field) => field.name),
      dirtyForm: this.isDirty(),
      touchedForm: this.isTouched(),
    };
  }

  dispose(): void {
    this.fields.clear();
    for (const key of Object.keys(this.initialValues)) {
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
}

export function required(message = "Required"): FieldValidator<unknown> {
  return (value) => {
    if (value === undefined || value === null || value === "") return message;
    return undefined;
  };
}

export function minLength(length: number, message = `Must be at least ${length} characters`): FieldValidator<unknown> {
  return (value) => {
    return typeof value === "string" && value.length < length ? message : undefined;
  };
}

function cloneRecord(record: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, [...value]]));
}
