// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../../types.ts";
import { insetRectangleByEdges, normalizeRectangle } from "../../utils/rectangles.ts";
import {
  type LayoutContractInvariantId,
  type LayoutSolverCapabilities,
  type LayoutSolverFieldSupport,
  TAFFY_LAYOUT_SOLVER_CAPABILITIES,
} from "../capabilities.ts";
import { measureTerminalTextIntrinsic } from "../measurement.ts";
import {
  cloneLayoutNode,
  type ComputedLayoutBox,
  computedLayoutBoxOverflow,
  flattenComputedLayoutBoxes,
  type LayoutNode,
  type LayoutSolver,
  type LayoutSolverInput,
  type LayoutSolverResult,
  mapLayoutBoxes,
} from "../solver.ts";

/** Stable name of the bridge protocol accepted by the opt-in Taffy adapter. */
export const TAFFY_BACKEND_PROTOCOL = "deno-tui.taffy-layout" as const;

/** Current bridge protocol version. */
export const TAFFY_BACKEND_PROTOCOL_VERSION = 1 as const;

/** Taffy crate series evaluated by this adapter spike. */
export const TAFFY_SUPPORTED_VERSION_SERIES = "0.12.x" as const;

/** Diagnostic codes produced before an unverified backend can affect layout. */
export type TaffyAdapterErrorCode =
  | "backend-unavailable"
  | "invalid-module"
  | "incompatible-protocol"
  | "incompatible-taffy-version"
  | "invalid-capabilities"
  | "invalid-backend"
  | "module-load-failed"
  | "backend-create-failed"
  | "backend-solve-failed"
  | "invalid-layout-tree"
  | "invalid-measurement"
  | "invalid-result"
  | "solver-disposed";

/** Fail-closed error raised by the experimental Taffy boundary. */
export class TaffyAdapterError extends Error {
  readonly code: TaffyAdapterErrorCode;

  constructor(code: TaffyAdapterErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "TaffyAdapterError";
    this.code = code;
  }
}

/** Parent-relative layout data returned by a bridge after running Taffy. */
export interface TaffyBackendLayoutNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Taffy's content-size width, when built with the `content_size` feature. */
  readonly contentWidth?: number;
  /** Taffy's content-size height, when built with the `content_size` feature. */
  readonly contentHeight?: number;
  readonly children: readonly TaffyBackendLayoutNode[];
}

/** A single synchronous solve result returned by a compatible bridge. */
export interface TaffyBackendSolveResult {
  readonly protocol: typeof TAFFY_BACKEND_PROTOCOL;
  readonly protocolVersion: typeof TAFFY_BACKEND_PROTOCOL_VERSION;
  readonly root: TaffyBackendLayoutNode;
}

/** Taffy `AvailableSpace`, represented without Rust or WASM handles. */
export type TaffyAvailableSpace = number | "min-content" | "max-content";

/** Measurement constraints supplied by a bridge to the host callback. */
export interface TaffyMeasureInput {
  readonly nodeId: string;
  readonly knownWidth: number | null;
  readonly knownHeight: number | null;
  readonly availableWidth: TaffyAvailableSpace;
  readonly availableHeight: TaffyAvailableSpace;
}

/** Intrinsic size returned to Taffy's measure closure. */
export interface TaffyMeasureOutput {
  readonly width: number;
  readonly height: number;
}

/** Serializable input plus a handle-free host measurement callback. */
export interface TaffyBackendSolveRequest {
  readonly protocol: typeof TAFFY_BACKEND_PROTOCOL;
  readonly protocolVersion: typeof TAFFY_BACKEND_PROTOCOL_VERSION;
  readonly bounds: Rectangle;
  /** A defensive clone of the renderer-neutral public layout tree. */
  readonly root: LayoutNode;
  /** Synchronous callback corresponding to `TaffyTree::compute_layout_with_measure`. */
  readonly measure: (input: TaffyMeasureInput) => TaffyMeasureOutput;
}

/** Manifest exported by a repository-specific wrapper around a Taffy 0.12.x bridge. */
export interface TaffyBackendManifest {
  readonly protocol: typeof TAFFY_BACKEND_PROTOCOL;
  readonly protocolVersion: typeof TAFFY_BACKEND_PROTOCOL_VERSION;
  readonly backendName: string;
  readonly taffyVersion: string;
  readonly capabilities: LayoutSolverCapabilities;
}

/** Synchronous backend instance created after any asynchronous WASM initialization. */
export interface TaffyBackend {
  solve(request: TaffyBackendSolveRequest): TaffyBackendSolveResult;
  supports?(root: LayoutNode): boolean;
  dispose?(): void;
}

/** Shape required from an opt-in dynamically loaded wrapper module. */
export interface TaffyBackendModule {
  readonly taffyBackendManifest: TaffyBackendManifest;
  createTaffyBackend(): TaffyBackend | Promise<TaffyBackend>;
}

/** Optional host measurement override for text, images, and custom widgets. */
export type TaffyMeasureNode = (
  node: Readonly<LayoutNode>,
  input: TaffyMeasureInput,
) => TaffyMeasureOutput;

/** Direct construction options for an already initialized bridge. */
export interface TaffyLayoutSolverOptions {
  manifest: TaffyBackendManifest;
  backend: TaffyBackend;
  measureNode?: TaffyMeasureNode;
}

/** Serializable inspection data for one loaded solver. */
export interface TaffyLayoutSolverInspection {
  readonly backendName: string;
  readonly taffyVersion: string;
  readonly protocolVersion: number;
  readonly disposed: boolean;
}

/**
 * LayoutSolver-compatible boundary for a separately supplied Taffy 0.12.x bridge.
 *
 * The adapter owns validation, terminal-cell projection, overflow metadata, hit
 * regions, measurement, and lifecycle. The backend only sees public layout data
 * and never exposes its TaffyTree, NodeId, allocator, or WASM handles.
 */
export class TaffyLayoutSolver implements LayoutSolver {
  readonly id = "taffy";
  readonly capabilities: LayoutSolverCapabilities;
  readonly backendName: string;
  readonly taffyVersion: string;

  readonly #backend: TaffyBackend;
  readonly #measureNode?: TaffyMeasureNode;
  #disposed = false;

  constructor(options: TaffyLayoutSolverOptions) {
    if (!options || typeof options !== "object") {
      throw adapterError("backend-unavailable", "Taffy requires an explicit opt-in backend and manifest.");
    }
    const manifest = validateManifest(options.manifest);
    this.#backend = validateBackend(options.backend);
    if (options.measureNode !== undefined && typeof options.measureNode !== "function") {
      throw adapterError("invalid-backend", "Taffy measureNode must be a function when provided.");
    }
    this.#measureNode = options.measureNode;
    this.capabilities = manifest.capabilities;
    this.backendName = manifest.backendName;
    this.taffyVersion = manifest.taffyVersion;
  }

  supports(root: LayoutNode): boolean {
    if (this.#disposed) return false;
    try {
      collectLayoutNodes(root);
      return this.#backend.supports ? this.#backend.supports(cloneLayoutNode(root)) === true : true;
    } catch {
      return false;
    }
  }

  solve(input: LayoutSolverInput): LayoutSolverResult {
    this.#assertActive();
    const sourceNodes = collectLayoutNodes(input.root);
    const bounds = normalizeRectangle(input.bounds);
    const request: TaffyBackendSolveRequest = {
      protocol: TAFFY_BACKEND_PROTOCOL,
      protocolVersion: TAFFY_BACKEND_PROTOCOL_VERSION,
      bounds,
      root: cloneLayoutNode(input.root),
      measure: (measurement) => this.#measure(sourceNodes, measurement),
    };

    let rawResult: unknown;
    try {
      rawResult = this.#backend.solve(request);
    } catch (cause) {
      if (cause instanceof TaffyAdapterError) throw cause;
      throw adapterError(
        "backend-solve-failed",
        `Taffy backend "${this.backendName}" failed while solving: ${causeMessage(cause)}`,
        cause,
      );
    }
    if (isThenable(rawResult)) {
      throw adapterError(
        "invalid-result",
        "Taffy backend solve() returned a Promise; LayoutSolver.solve() and measurement must remain synchronous.",
      );
    }

    const result = validateSolveResult(rawResult);
    const root = projectComputedBox(
      input.root,
      result.root,
      { x: bounds.column, y: bounds.row },
      true,
      "root",
    );
    const boxes = flattenComputedLayoutBoxes(root);
    return {
      root,
      boxes,
      byId: mapLayoutBoxes(boxes),
      contentWidth: root.scrollWidth,
      contentHeight: root.scrollHeight,
    };
  }

  /** Releases the backend instance. Calling dispose more than once is harmless. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#backend.dispose?.();
  }

  inspect(): TaffyLayoutSolverInspection {
    return {
      backendName: this.backendName,
      taffyVersion: this.taffyVersion,
      protocolVersion: TAFFY_BACKEND_PROTOCOL_VERSION,
      disposed: this.#disposed,
    };
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw adapterError("solver-disposed", `Taffy backend "${this.backendName}" has already been disposed.`);
    }
  }

  #measure(nodes: ReadonlyMap<string, LayoutNode>, rawInput: TaffyMeasureInput): TaffyMeasureOutput {
    const input = validateMeasureInput(rawInput);
    const node = nodes.get(input.nodeId);
    if (!node) {
      throw adapterError("invalid-measurement", `Taffy requested measurement for unknown node "${input.nodeId}".`);
    }
    const measured = this.#measureNode ? this.#measureNode(node, input) : defaultMeasureNode(node, input);
    if (!isRecord(measured) || !isNonNegativeFinite(measured.width) || !isNonNegativeFinite(measured.height)) {
      throw adapterError(
        "invalid-measurement",
        `Measurement for node "${input.nodeId}" must return finite non-negative width and height.`,
      );
    }
    return {
      width: input.knownWidth ?? measured.width,
      height: input.knownHeight ?? measured.height,
    };
  }
}

/** Creates a solver around an already initialized, explicitly supplied backend. */
export function taffyLayoutSolver(options: TaffyLayoutSolverOptions): TaffyLayoutSolver {
  return new TaffyLayoutSolver(options);
}

/** Module-loading options shared by terminal, browser, and worker callers. */
export interface TaffyLayoutSolverLoaderOptions {
  /** Caller-owned dynamic import. The library never guesses or downloads a package. */
  loadModule: () => unknown | Promise<unknown>;
  measureNode?: TaffyMeasureNode;
}

/** Observable module-cache state; backend instances are never shared. */
export interface TaffyLayoutSolverLoaderInspection {
  readonly state: "idle" | "loading" | "ready" | "failed";
  readonly moduleLoads: number;
  readonly backendCreations: number;
  readonly lastErrorCode?: TaffyAdapterErrorCode;
}

interface ValidatedBackendModule {
  manifest: TaffyBackendManifest;
  createBackend: () => TaffyBackend | Promise<TaffyBackend>;
}

/**
 * Caches only validation of the caller-supplied module import. Each createSolver
 * call receives an independent backend, so disposal cannot invalidate peers.
 */
export class TaffyLayoutSolverLoader {
  readonly #loadModule: () => unknown | Promise<unknown>;
  readonly #measureNode?: TaffyMeasureNode;
  #modulePromise?: Promise<ValidatedBackendModule>;
  #state: TaffyLayoutSolverLoaderInspection["state"] = "idle";
  #moduleLoads = 0;
  #backendCreations = 0;
  #lastErrorCode?: TaffyAdapterErrorCode;

  constructor(options: TaffyLayoutSolverLoaderOptions) {
    if (!options || typeof options.loadModule !== "function") {
      throw adapterError(
        "backend-unavailable",
        "Taffy is opt-in; provide loadModule: () => import(<pinned bridge module>).",
      );
    }
    this.#loadModule = options.loadModule;
    this.#measureNode = options.measureNode;
  }

  async createSolver(): Promise<TaffyLayoutSolver> {
    const module = await this.#loadValidatedModule();
    let backend: unknown;
    try {
      backend = await module.createBackend();
    } catch (cause) {
      const error = adapterError(
        "backend-create-failed",
        `Taffy backend "${module.manifest.backendName}" could not initialize: ${causeMessage(cause)}`,
        cause,
      );
      this.#lastErrorCode = error.code;
      throw error;
    }

    try {
      const solver = new TaffyLayoutSolver({
        manifest: module.manifest,
        backend: validateBackend(backend),
        measureNode: this.#measureNode,
      });
      this.#backendCreations += 1;
      this.#lastErrorCode = undefined;
      return solver;
    } catch (cause) {
      disposeUnknownBackend(backend);
      if (cause instanceof TaffyAdapterError) this.#lastErrorCode = cause.code;
      throw cause;
    }
  }

  /**
   * Drops this loader's validated-module reference. ESM runtimes may still keep
   * their own import cache. An in-flight import is never reset underneath callers.
   */
  resetModuleCache(): boolean {
    if (this.#state === "loading") return false;
    this.#modulePromise = undefined;
    this.#state = "idle";
    this.#lastErrorCode = undefined;
    return true;
  }

  inspect(): TaffyLayoutSolverLoaderInspection {
    return {
      state: this.#state,
      moduleLoads: this.#moduleLoads,
      backendCreations: this.#backendCreations,
      lastErrorCode: this.#lastErrorCode,
    };
  }

  #loadValidatedModule(): Promise<ValidatedBackendModule> {
    if (this.#modulePromise) return this.#modulePromise;
    this.#state = "loading";
    this.#moduleLoads += 1;
    const promise = Promise.resolve()
      .then(() => this.#loadModule())
      .then((module) => validateBackendModule(module))
      .then(
        (module) => {
          this.#state = "ready";
          this.#lastErrorCode = undefined;
          return module;
        },
        (cause) => {
          const error = cause instanceof TaffyAdapterError
            ? cause
            : adapterError("module-load-failed", `Taffy bridge module failed to load: ${causeMessage(cause)}`, cause);
          this.#state = "failed";
          this.#lastErrorCode = error.code;
          this.#modulePromise = undefined;
          throw error;
        },
      );
    this.#modulePromise = promise;
    return promise;
  }
}

/** Loads one independent solver without establishing any package-global cache. */
export async function loadTaffyLayoutSolver(
  options: TaffyLayoutSolverLoaderOptions,
): Promise<TaffyLayoutSolver> {
  return await new TaffyLayoutSolverLoader(options).createSolver();
}

/** Validates a wrapper module without instantiating its WASM backend. */
export function inspectTaffyBackendModule(module: unknown): TaffyBackendManifest {
  return validateBackendModule(module).manifest;
}

function validateBackendModule(value: unknown): ValidatedBackendModule {
  if (!isRecord(value)) {
    throw adapterError("invalid-module", "Taffy bridge loader must resolve to a module namespace object.");
  }
  if (typeof value.createTaffyBackend !== "function") {
    throw adapterError("invalid-module", "Taffy bridge module must export createTaffyBackend().");
  }
  return {
    manifest: validateManifest(value.taffyBackendManifest),
    createBackend: value.createTaffyBackend as () => TaffyBackend | Promise<TaffyBackend>,
  };
}

function validateManifest(value: unknown): TaffyBackendManifest {
  if (!isRecord(value)) {
    throw adapterError("invalid-module", "Taffy bridge module must export taffyBackendManifest.");
  }
  if (value.protocol !== TAFFY_BACKEND_PROTOCOL || value.protocolVersion !== TAFFY_BACKEND_PROTOCOL_VERSION) {
    throw adapterError(
      "incompatible-protocol",
      `Taffy bridge must implement ${TAFFY_BACKEND_PROTOCOL}@${TAFFY_BACKEND_PROTOCOL_VERSION}.`,
    );
  }
  if (typeof value.backendName !== "string" || value.backendName.trim().length === 0) {
    throw adapterError("invalid-module", "Taffy bridge manifest backendName must be a non-empty string.");
  }
  if (typeof value.taffyVersion !== "string" || !isSupportedTaffyVersion(value.taffyVersion)) {
    throw adapterError(
      "incompatible-taffy-version",
      `Taffy bridge reported "${
        String(value.taffyVersion)
      }"; this spike accepts only ${TAFFY_SUPPORTED_VERSION_SERIES}.`,
    );
  }
  return Object.freeze({
    protocol: TAFFY_BACKEND_PROTOCOL,
    protocolVersion: TAFFY_BACKEND_PROTOCOL_VERSION,
    backendName: value.backendName.trim(),
    taffyVersion: value.taffyVersion,
    capabilities: validateCapabilities(value.capabilities),
  });
}

function validateCapabilities(value: unknown): LayoutSolverCapabilities {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.solverId !== "taffy") {
    throw adapterError(
      "invalid-capabilities",
      "Taffy bridge must publish schemaVersion 1 capabilities for solverId taffy.",
    );
  }
  if (value.availability !== "optional" && value.availability !== "custom") {
    throw adapterError(
      "invalid-capabilities",
      "A loaded Taffy bridge must report optional or custom availability, never planned or built-in.",
    );
  }
  const style = validateSupportRecord(
    value.style,
    Object.keys(TAFFY_LAYOUT_SOLVER_CAPABILITIES.style),
    "style",
  );
  const displayModes = validateSupportRecord(value.displayModes, ["block", "flex", "grid", "none"], "displayModes");
  const lengthUnits = validateSupportRecord(value.lengthUnits, ["auto", "cell", "percent", "fr"], "lengthUnits");
  const invariantIds: LayoutContractInvariantId[] = [
    "cell-rounding",
    "overflow-inspection",
    "intrinsic-measurement",
    "hidden-nodes",
    "absolute-children",
    "min-max-constraints",
  ];
  if (!isRecord(value.invariants)) {
    throw adapterError("invalid-capabilities", "Taffy capability invariants must be an object.");
  }
  const invariants = {} as Record<LayoutContractInvariantId, { support: LayoutSolverFieldSupport; detail: string }>;
  for (const id of invariantIds) {
    const invariant = value.invariants[id];
    if (!isRecord(invariant) || !isSupport(invariant.support) || typeof invariant.detail !== "string") {
      throw adapterError("invalid-capabilities", `Taffy capability invariant "${id}" is incomplete.`);
    }
    invariants[id] = Object.freeze({ support: invariant.support, detail: invariant.detail });
  }
  if (!isRecord(value.limitations)) {
    throw adapterError("invalid-capabilities", "Taffy capability limitations must be an object.");
  }
  const limitations: Record<string, readonly string[]> = {};
  for (const [field, entries] of Object.entries(value.limitations)) {
    if (!(field in style) || !Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
      throw adapterError("invalid-capabilities", `Taffy capability limitation "${field}" is invalid.`);
    }
    limitations[field] = Object.freeze(entries.slice()) as readonly string[];
  }
  if (!Array.isArray(value.notes) || !value.notes.every((note) => typeof note === "string")) {
    throw adapterError("invalid-capabilities", "Taffy capability notes must be an array of strings.");
  }
  return Object.freeze({
    schemaVersion: 1,
    solverId: "taffy",
    availability: value.availability,
    style: Object.freeze(style),
    displayModes: Object.freeze(displayModes) as LayoutSolverCapabilities["displayModes"],
    lengthUnits: Object.freeze(lengthUnits) as LayoutSolverCapabilities["lengthUnits"],
    invariants: Object.freeze(invariants),
    limitations: Object.freeze(limitations),
    notes: Object.freeze(value.notes.slice()) as readonly string[],
  }) as LayoutSolverCapabilities;
}

function validateSupportRecord(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, LayoutSolverFieldSupport> {
  if (!isRecord(value)) {
    throw adapterError("invalid-capabilities", `Taffy capability ${label} must be an object.`);
  }
  const output: Record<string, LayoutSolverFieldSupport> = {};
  for (const key of expectedKeys) {
    if (!isSupport(value[key])) {
      throw adapterError("invalid-capabilities", `Taffy capability ${label}.${key} is missing or invalid.`);
    }
    output[key] = value[key];
  }
  return output;
}

function validateBackend(value: unknown): TaffyBackend {
  if (!isRecord(value) || typeof value.solve !== "function") {
    throw adapterError("invalid-backend", "createTaffyBackend() must return an object with synchronous solve().");
  }
  if (value.supports !== undefined && typeof value.supports !== "function") {
    throw adapterError("invalid-backend", "Taffy backend supports must be a function when provided.");
  }
  if (value.dispose !== undefined && typeof value.dispose !== "function") {
    throw adapterError("invalid-backend", "Taffy backend dispose must be a function when provided.");
  }
  return value as unknown as TaffyBackend;
}

function validateSolveResult(value: unknown): TaffyBackendSolveResult {
  if (
    !isRecord(value) || value.protocol !== TAFFY_BACKEND_PROTOCOL ||
    value.protocolVersion !== TAFFY_BACKEND_PROTOCOL_VERSION
  ) {
    throw adapterError(
      "invalid-result",
      `Taffy solve result must identify ${TAFFY_BACKEND_PROTOCOL}@${TAFFY_BACKEND_PROTOCOL_VERSION}.`,
    );
  }
  if (!isRecord(value.root)) throw adapterError("invalid-result", "Taffy solve result is missing root layout data.");
  return value as unknown as TaffyBackendSolveResult;
}

function projectComputedBox(
  node: LayoutNode,
  rawLayout: unknown,
  parentFloatOrigin: { x: number; y: number },
  ancestorDisplayed: boolean,
  path: string,
): ComputedLayoutBox {
  const layout = validateLayoutNode(rawLayout, node, path);
  const left = parentFloatOrigin.x + layout.x;
  const top = parentFloatOrigin.y + layout.y;
  const right = left + layout.width;
  const bottom = top + layout.height;
  const roundedLeft = Math.round(left);
  const roundedTop = Math.round(top);
  const rect: Rectangle = {
    column: roundedLeft,
    row: roundedTop,
    width: Math.max(0, Math.round(right) - roundedLeft),
    height: Math.max(0, Math.round(bottom) - roundedTop),
  };
  const contentRect = insetRectangleByEdges(rect, node.style.border, node.style.padding);
  const displayed = ancestorDisplayed && node.style.display !== "none";
  const visible = displayed && node.style.visibility === "visible";
  const children = new Array<ComputedLayoutBox>(node.children.length);
  let scrollWidth = Math.max(contentRect.width, roundedExtent(layout.contentWidth));
  let scrollHeight = Math.max(contentRect.height, roundedExtent(layout.contentHeight));
  for (let index = 0; index < node.children.length; index += 1) {
    const child = projectComputedBox(
      node.children[index]!,
      layout.children[index],
      { x: left, y: top },
      displayed,
      `${path}.children[${index}]`,
    );
    children[index] = child;
    scrollWidth = Math.max(scrollWidth, child.rect.column + child.rect.width - contentRect.column);
    scrollHeight = Math.max(scrollHeight, child.rect.row + child.rect.height - contentRect.row);
  }
  scrollWidth = Math.max(0, scrollWidth);
  scrollHeight = Math.max(0, scrollHeight);
  return {
    id: node.id,
    tag: node.tag,
    classes: node.classes.slice(),
    attributes: { ...node.attributes },
    text: node.text,
    rect,
    contentRect,
    padding: { ...node.style.padding },
    margin: { ...node.style.margin },
    border: { ...node.style.border },
    overflowX: node.style.overflowX,
    overflowY: node.style.overflowY,
    scrollWidth,
    scrollHeight,
    overflow: computedLayoutBoxOverflow(
      contentRect,
      scrollWidth,
      scrollHeight,
      node.style.overflowX,
      node.style.overflowY,
    ),
    zIndex: node.style.zIndex,
    visible,
    hitRegions: visible
      ? [{ id: node.id, bounds: rect, zIndex: node.style.zIndex, payload: { nodeId: node.id, tag: node.tag } }]
      : [],
    children,
  };
}

function validateLayoutNode(
  value: unknown,
  expected: LayoutNode,
  path: string,
): TaffyBackendLayoutNode {
  if (!isRecord(value)) throw adapterError("invalid-result", `Taffy result ${path} must be an object.`);
  if (value.id !== expected.id) {
    throw adapterError(
      "invalid-result",
      `Taffy result ${path} has id "${String(value.id)}"; expected "${expected.id}".`,
    );
  }
  for (const field of ["x", "y"] as const) {
    if (!isFiniteNumber(value[field])) {
      throw adapterError("invalid-result", `Taffy result ${path}.${field} must be finite.`);
    }
  }
  for (const field of ["width", "height"] as const) {
    if (!isNonNegativeFinite(value[field])) {
      throw adapterError("invalid-result", `Taffy result ${path}.${field} must be finite and non-negative.`);
    }
  }
  for (const field of ["contentWidth", "contentHeight"] as const) {
    if (value[field] !== undefined && !isNonNegativeFinite(value[field])) {
      throw adapterError(
        "invalid-result",
        `Taffy result ${path}.${field} must be finite and non-negative when present.`,
      );
    }
  }
  if (!Array.isArray(value.children) || value.children.length !== expected.children.length) {
    throw adapterError(
      "invalid-result",
      `Taffy result ${path}.children must contain exactly ${expected.children.length} entries in source-tree order.`,
    );
  }
  return value as unknown as TaffyBackendLayoutNode;
}

function collectLayoutNodes(root: LayoutNode): Map<string, LayoutNode> {
  const nodes = new Map<string, LayoutNode>();
  const seen = new Set<LayoutNode>();
  visit(root, "root");
  return nodes;

  function visit(node: LayoutNode, path: string): void {
    if (seen.has(node)) throw adapterError("invalid-layout-tree", `Layout tree cycle detected at ${path}.`);
    if (nodes.has(node.id)) {
      throw adapterError("invalid-layout-tree", `Layout node id "${node.id}" is duplicated at ${path}.`);
    }
    seen.add(node);
    nodes.set(node.id, node);
    for (let index = 0; index < node.children.length; index += 1) {
      visit(node.children[index]!, `${path}.children[${index}]`);
    }
  }
}

function validateMeasureInput(value: unknown): TaffyMeasureInput {
  if (!isRecord(value) || typeof value.nodeId !== "string") {
    throw adapterError("invalid-measurement", "Taffy measurement input must identify a nodeId.");
  }
  if (!isNullableNonNegativeFinite(value.knownWidth) || !isNullableNonNegativeFinite(value.knownHeight)) {
    throw adapterError("invalid-measurement", `Taffy measurement for "${value.nodeId}" has invalid known dimensions.`);
  }
  if (!isAvailableSpace(value.availableWidth) || !isAvailableSpace(value.availableHeight)) {
    throw adapterError("invalid-measurement", `Taffy measurement for "${value.nodeId}" has invalid available space.`);
  }
  return value as unknown as TaffyMeasureInput;
}

function defaultMeasureNode(node: LayoutNode, input: TaffyMeasureInput): TaffyMeasureOutput {
  const availableWidth = typeof input.availableWidth === "number"
    ? Math.max(1, input.availableWidth)
    : Number.MAX_SAFE_INTEGER;
  const textSize = node.text === undefined
    ? { width: 0, height: 0 }
    : measureTerminalTextIntrinsic(node.text, availableWidth, 1, {
      wrap: node.style.whiteSpace !== "nowrap" && node.style.whiteSpace !== "pre",
      breakWords: node.style.overflowWrap === "anywhere" || node.style.overflowWrap === "break-word",
      preserveNewlines: true,
    });
  return {
    width: input.knownWidth ?? node.intrinsic?.width ?? textSize.width,
    height: input.knownHeight ?? node.intrinsic?.height ?? textSize.height,
  };
}

function isSupportedTaffyVersion(version: string): boolean {
  return /^0\.12\.(?:0|[1-9]\d*)$/.test(version);
}

function isSupport(value: unknown): value is LayoutSolverFieldSupport {
  return value === "supported" || value === "partial" || value === "metadata" ||
    value === "outside-solver" || value === "unsupported" || value === "unknown";
}

function isAvailableSpace(value: unknown): value is TaffyAvailableSpace {
  return value === "min-content" || value === "max-content" || isNonNegativeFinite(value);
}

function isNullableNonNegativeFinite(value: unknown): value is number | null {
  return value === null || isNonNegativeFinite(value);
}

function roundedExtent(value: number | undefined): number {
  return value === undefined ? 0 : Math.max(0, Math.round(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThenable(value: unknown): boolean {
  return isRecord(value) && typeof value.then === "function";
}

function disposeUnknownBackend(value: unknown): void {
  if (!isRecord(value) || typeof value.dispose !== "function") return;
  try {
    value.dispose();
  } catch {
    // Construction already failed; disposal remains best-effort and cannot hide it.
  }
}

function causeMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message.trim();
  return typeof cause === "string" && cause.trim() ? cause.trim() : "unknown error";
}

function adapterError(code: TaffyAdapterErrorCode, message: string, cause?: unknown): TaffyAdapterError {
  return new TaffyAdapterError(code, message, cause);
}
