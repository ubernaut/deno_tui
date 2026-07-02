import type { DiskSnapshot } from "./types.ts";

/** Parses portable `df -B1P` output into bounded disk snapshots sorted by usage pressure. */
export function parseDfDiskRows(output: string, limit = 8): DiskSnapshot[] {
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
    disks.push({
      filesystem,
      mount,
      total: Number(parts[1] ?? 0),
      used: Number(parts[2] ?? 0),
      available: Number(parts[3] ?? 0),
      percent: Number((parts[4] ?? "0").replace("%", "")),
    });
  }
  disks.sort((a, b) => b.percent - a.percent);
  const safeLimit = Math.max(0, Math.floor(limit));
  return disks.length > safeLimit ? disks.slice(0, safeLimit) : disks;
}
