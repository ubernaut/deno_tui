// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { WorkerPool, WorkerPoolRunOptions } from "../runtime/worker_pool.ts";
import type { ApplyCssCascadeOptions } from "./cascade.ts";
import type { TuiCssStylesheet } from "./css.ts";
import { createMarkupLayout, MarkupLayoutCache, type MarkupLayoutCacheOptions } from "./hydrate.ts";
import type { TuiMarkupDocument, TuiMarkupParseOptions } from "./html.ts";
import type { LayoutNode, LayoutSolverResult } from "../layout/solver.ts";

/** Payload accepted by the markup layout worker helper. */
export interface MarkupLayoutWorkerPayload {
  markup: string;
  css?: string;
  stylesheet?: TuiCssStylesheet;
  bounds: Rectangle;
  parse?: TuiMarkupParseOptions;
  cascade?: ApplyCssCascadeOptions;
  cache?: boolean;
}

/** Serializable markup layout result returned from worker-backed layout. */
export interface MarkupLayoutWorkerResult {
  document: TuiMarkupDocument;
  styledRoot: LayoutNode;
  layout: LayoutSolverResult;
  cache?: {
    documents: number;
    stylesheets: number;
    maxEntries: number;
  };
}

/** Options for creating a markup layout worker handler. */
export interface MarkupLayoutWorkerHandlerOptions {
  cache?: MarkupLayoutCache | false;
  cacheOptions?: MarkupLayoutCacheOptions;
}

/** Worker handler signature for markup layout jobs. */
export type MarkupLayoutWorkerHandler = (
  payload: MarkupLayoutWorkerPayload,
) => MarkupLayoutWorkerResult;

/** Creates a worker-compatible handler for parsing CSS/markup and solving layout off the UI thread. */
export function createMarkupLayoutWorkerHandler(
  options: MarkupLayoutWorkerHandlerOptions = {},
): MarkupLayoutWorkerHandler {
  const cache = options.cache === false ? false : options.cache ?? new MarkupLayoutCache(options.cacheOptions);
  return (payload: MarkupLayoutWorkerPayload): MarkupLayoutWorkerResult => {
    const activeCache = payload.cache === false ? false : cache;
    const result = createMarkupLayout({
      markup: payload.markup,
      css: payload.css,
      stylesheet: payload.stylesheet,
      bounds: payload.bounds,
      parse: payload.parse,
      cascade: payload.cascade,
      widgets: false,
      cache: activeCache,
    });
    const output: MarkupLayoutWorkerResult = {
      document: result.document,
      styledRoot: result.styledRoot,
      layout: result.layout,
    };
    if (activeCache) output.cache = activeCache.inspect();
    return output;
  };
}

/** Runs a markup layout job through a WorkerPool. */
export function runMarkupLayoutInWorker(
  pool: WorkerPool<MarkupLayoutWorkerPayload, MarkupLayoutWorkerResult>,
  payload: MarkupLayoutWorkerPayload,
  options: WorkerPoolRunOptions = {},
): Promise<MarkupLayoutWorkerResult> {
  return pool.run(payload, options);
}
