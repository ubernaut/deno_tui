// Copyright 2023 Im-Beast. MIT license.
import { type AnsiStyleSpec, createAnsiStyle, type Style } from "./theme_ansi.ts";

/** Internal style reference accepted by serializable theme manifests. */
export type ThemeManifestStyleReferenceCore =
  | string
  | AnsiStyleSpec
  | readonly ThemeManifestStyleReferenceCore[];

/** Internal compiled style reference emitted from serializable theme manifests. */
export type CompiledThemeManifestStyleReferenceCore =
  | string
  | Style
  | readonly CompiledThemeManifestStyleReferenceCore[];

/** Internal generic state map accepted by serializable theme manifests. */
export type ThemeManifestStateDefinitionCore<State extends string> = Partial<
  Record<State, ThemeManifestStyleReferenceCore>
>;

/** Internal generic state map emitted from serializable theme manifests. */
export type CompiledThemeManifestStateDefinitionCore<State extends string> = Partial<
  Record<State, CompiledThemeManifestStyleReferenceCore>
>;

/** Compiles a serializable manifest style reference into a runtime style reference. */
export function compileThemeManifestStyleReferenceCore(
  reference: ThemeManifestStyleReferenceCore,
): CompiledThemeManifestStyleReferenceCore {
  if (isThemeManifestStyleReferencePipelineCore(reference)) {
    return reference.map((part) => compileThemeManifestStyleReferenceCore(part));
  }
  return typeof reference === "string" ? reference : createAnsiStyle(reference);
}

/** Compiles a serializable manifest state definition into runtime style references. */
export function compileThemeManifestStateDefinitionCore<State extends string>(
  definition: ThemeManifestStateDefinitionCore<State> = {},
): CompiledThemeManifestStateDefinitionCore<State> {
  const output: CompiledThemeManifestStateDefinitionCore<State> = {};
  for (const [state, reference] of Object.entries(definition) as [State, ThemeManifestStyleReferenceCore][]) {
    if (reference === undefined) continue;
    output[state] = compileThemeManifestStyleReferenceCore(reference);
  }
  return output;
}

function isThemeManifestStyleReferencePipelineCore(
  reference: ThemeManifestStyleReferenceCore,
): reference is readonly ThemeManifestStyleReferenceCore[] {
  return Array.isArray(reference);
}
