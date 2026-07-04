export interface WorkbenchAnsiScreenSpanRowCache {
  width: number;
  fingerprint: string;
  line?: string;
}

export function workbenchAnsiSpanRowCleanCacheMatches(
  cache: WorkbenchAnsiScreenSpanRowCache | undefined,
  width: number,
  fingerprint: string | undefined,
): boolean {
  return fingerprint !== undefined && cache?.width === Math.max(0, Math.floor(width)) &&
    cache.fingerprint === fingerprint;
}

export function workbenchAnsiSpanRowRenderedHintCacheMatches(
  cache: WorkbenchAnsiScreenSpanRowCache | undefined,
  width: number,
  renderedHint: string | undefined,
): boolean {
  return renderedHint !== undefined && cache?.width === Math.max(0, Math.floor(width)) &&
    cache.line === renderedHint;
}
