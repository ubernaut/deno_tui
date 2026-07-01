import type { ProcessSnapshot } from "./types.ts";

export type SystemProcessSortKey = "cpu" | "memory" | "pid" | "name";

export interface ParsedProcessStat {
  name: string;
  state: string;
  cpuTime: number;
  memoryBytes: number;
  processor?: number;
}

export function processComparator(
  sortKey: SystemProcessSortKey,
): (left: ProcessSnapshot, right: ProcessSnapshot) => number {
  switch (sortKey) {
    case "memory":
      return (left, right) =>
        right.memoryBytes - left.memoryBytes || right.cpuPercent - left.cpuPercent ||
        left.pid - right.pid;
    case "pid":
      return (left, right) => left.pid - right.pid;
    case "name":
      return (left, right) =>
        left.name.localeCompare(right.name) || right.cpuPercent - left.cpuPercent ||
        left.pid - right.pid;
    case "cpu":
      return (left, right) =>
        right.cpuPercent - left.cpuPercent || right.memoryBytes - left.memoryBytes ||
        left.pid - right.pid;
  }
}

export function parseProcessStat(stat: string, pageSize: number): ParsedProcessStat | null {
  const open = stat.indexOf("(");
  const close = stat.lastIndexOf(")");
  if (open === -1 || close === -1) {
    return null;
  }
  const name = stat.slice(open + 1, close);
  const fields = readProcessStatFields(stat, close + 2);
  const state = fields.state ?? "?";
  const utime = fields.utime ?? 0;
  const stime = fields.stime ?? 0;
  const rssPages = fields.rssPages ?? 0;
  const processor = fields.processor ?? Number.NaN;
  return {
    name,
    state,
    cpuTime: utime + stime,
    memoryBytes: rssPages * pageSize,
    processor: Number.isFinite(processor) ? processor : undefined,
  };
}

function readProcessStatFields(stat: string, start: number): {
  state?: string;
  utime?: number;
  stime?: number;
  rssPages?: number;
  processor?: number;
} {
  let tokenIndex = 0;
  let tokenStart = -1;
  let state: string | undefined;
  let utime: number | undefined;
  let stime: number | undefined;
  let rssPages: number | undefined;
  let processor: number | undefined;

  for (let index = start; index <= stat.length; index += 1) {
    const code = index < stat.length ? stat.charCodeAt(index) : 32;
    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13;
    if (isWhitespace) {
      if (tokenStart !== -1) {
        if (tokenIndex === 0) {
          state = stat.slice(tokenStart, index);
        } else if (tokenIndex === 11) {
          utime = Number(stat.slice(tokenStart, index));
        } else if (tokenIndex === 12) {
          stime = Number(stat.slice(tokenStart, index));
        } else if (tokenIndex === 21) {
          rssPages = Number(stat.slice(tokenStart, index));
        } else if (tokenIndex === 36) {
          processor = Number(stat.slice(tokenStart, index));
          break;
        }
        tokenIndex += 1;
        tokenStart = -1;
      }
    } else if (tokenStart === -1) {
      tokenStart = index;
    }
  }

  return { state, utime, stime, rssPages, processor };
}
