export const DEFAULT_MAX_CHANGED_SPANS_PER_ROW = 8;
export const DEFAULT_MERGE_CHANGED_SPAN_GAP = 2;

export interface ChangedSpan {
  start: number;
  end: number;
  width: number;
}

export interface ChangedSpansOptions {
  maxSpans?: number;
  mergeGap?: number;
}

export function changedSpansInto(
  spans: ChangedSpan[],
  pool: ChangedSpan[],
  previous: readonly string[],
  next: readonly string[],
  width: number,
  options: ChangedSpansOptions = {},
): ChangedSpan[] {
  spans.length = 0;
  const columns = Math.max(0, Math.floor(width));
  const maxSpans = Math.max(1, Math.floor(options.maxSpans ?? DEFAULT_MAX_CHANGED_SPANS_PER_ROW));
  const mergeGap = Math.max(0, Math.floor(options.mergeGap ?? DEFAULT_MERGE_CHANGED_SPAN_GAP));
  let spanStart = -1;
  let lastChanged = -1;

  for (let column = 0; column < columns; column += 1) {
    const nextCell = next[column] ?? " ";
    if (previous[column] === nextCell) continue;

    if (spanStart < 0) {
      spanStart = column;
    } else if (column - lastChanged > mergeGap + 1) {
      writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
      if (spans.length >= maxSpans) {
        spanStart = column;
        lastChanged = column;
        break;
      }
      spanStart = column;
    }
    lastChanged = column;
  }

  if (spanStart < 0) return spans;
  if (spans.length >= maxSpans) {
    writeChangedSpan(spans, pool, spans.length - 1, spans[spans.length - 1]!.start, columns - 1);
    return spans;
  }
  writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
  return spans;
}

export function snapshotChangedSpans(
  row: readonly string[],
  snapshot: string[],
  spans: readonly ChangedSpan[],
): string[] {
  for (const span of spans) {
    for (let column = span.start; column <= span.end; column += 1) {
      snapshot[column] = row[column] ?? " ";
    }
  }
  return snapshot;
}

export function snapshotFrameRow(
  row: readonly string[],
  width: number,
  reuse?: string[],
  start = 0,
  end = width - 1,
): string[] {
  const snapshot = reuse ?? [];
  const columns = Math.max(0, Math.floor(width));
  if (snapshot.length !== columns) {
    snapshot.length = columns;
  }
  const first = Math.max(0, Math.floor(start));
  const last = Math.min(columns - 1, Math.floor(end));
  for (let column = first; column <= last; column += 1) {
    snapshot[column] = row[column] ?? " ";
  }
  return snapshot;
}

function writeChangedSpan(
  spans: ChangedSpan[],
  pool: ChangedSpan[],
  index: number,
  start: number,
  end: number,
): void {
  const span = pool[index];
  if (span) {
    span.start = start;
    span.end = end;
    span.width = end - start + 1;
    spans[index] = span;
    return;
  }
  const nextSpan = { start, end, width: end - start + 1 };
  pool[index] = nextSpan;
  spans[index] = nextSpan;
}
