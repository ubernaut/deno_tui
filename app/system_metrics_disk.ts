import type { DiskSnapshot } from "./types.ts";

/** Parses portable `df -B1P` output into bounded disk snapshots sorted by usage pressure. */
export function parseDfDiskRows(output: string, limit = 8): DiskSnapshot[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  const disks: DiskSnapshot[] = [];
  const lines = output.split("\n");
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const filesystem = parts[0] ?? "";
    const mount = parts[5] ?? "/";
    if (!filesystem.startsWith("/dev/") && mount !== "/") continue;
    insertDiskSnapshot(disks, {
      filesystem,
      mount,
      total: Number(parts[1] ?? 0),
      used: Number(parts[2] ?? 0),
      available: Number(parts[3] ?? 0),
      percent: Number((parts[4] ?? "0").replace("%", "")),
    }, safeLimit);
  }
  return disks;
}

function insertDiskSnapshot(disks: DiskSnapshot[], disk: DiskSnapshot, limit: number): void {
  if (disks.length === limit && disk.percent <= (disks[disks.length - 1]?.percent ?? -Infinity)) return;

  let index = 0;
  while (index < disks.length && (disks[index]?.percent ?? -Infinity) >= disk.percent) {
    index += 1;
  }
  disks.splice(index, 0, disk);
  if (disks.length > limit) disks.length = limit;
}
