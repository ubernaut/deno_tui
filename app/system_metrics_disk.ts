import type { DiskSnapshot } from "./types.ts";

/** Parses portable `df -B1P` output into bounded disk snapshots sorted by usage pressure. */
export function parseDfDiskRows(output: string, limit = 8): DiskSnapshot[] {
  return output
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 6)
    .map((parts) => {
      const filesystem = parts[0] ?? "";
      const total = Number(parts[1] ?? 0);
      const used = Number(parts[2] ?? 0);
      const available = Number(parts[3] ?? 0);
      const percent = Number((parts[4] ?? "0").replace("%", ""));
      const mount = parts[5] ?? "/";
      return {
        filesystem,
        mount,
        total,
        used,
        available,
        percent,
      } satisfies DiskSnapshot;
    })
    .filter((entry) => entry.filesystem.startsWith("/dev/") || entry.mount === "/")
    .sort((a, b) => b.percent - a.percent)
    .slice(0, Math.max(0, Math.floor(limit)));
}
