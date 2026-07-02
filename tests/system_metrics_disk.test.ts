import { assertEquals } from "./deps.ts";
import { parseDfDiskRows } from "../app/system_metrics_disk.ts";

Deno.test("parseDfDiskRows filters virtual filesystems and sorts by usage", () => {
  const disks = parseDfDiskRows([
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/nvme0n1p2 1000 850 150 85% /",
    "tmpfs 100 2 98 2% /run",
    "/dev/nvme0n1p1 500 125 375 25% /boot",
    "overlay 200 199 1 99% /var/lib/container",
    "/dev/sda1 800 720 80 90% /mnt/archive",
  ].join("\n"));

  assertEquals(disks.map((disk) => [disk.filesystem, disk.mount, disk.percent]), [
    ["/dev/sda1", "/mnt/archive", 90],
    ["/dev/nvme0n1p2", "/", 85],
    ["/dev/nvme0n1p1", "/boot", 25],
  ]);
});

Deno.test("parseDfDiskRows caps output and preserves numeric byte fields", () => {
  const disks = parseDfDiskRows(
    [
      "Filesystem 1B-blocks Used Available Use% Mounted on",
      "/dev/a 10 9 1 90% /a",
      "/dev/b 20 10 10 50% /b",
      "/dev/c 30 3 27 10% /c",
    ].join("\n"),
    2,
  );

  assertEquals(disks, [
    { filesystem: "/dev/a", mount: "/a", total: 10, used: 9, available: 1, percent: 90 },
    { filesystem: "/dev/b", mount: "/b", total: 20, used: 10, available: 10, percent: 50 },
  ]);
});

Deno.test("parseDfDiskRows preserves stable ordering for equal pressure and zero limits", () => {
  const output = [
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/a 10 7 3 70% /a",
    "/dev/b 10 7 3 70% /b",
    "/dev/c 10 9 1 90% /c",
  ].join("\n");

  assertEquals(parseDfDiskRows(output, 0), []);
  assertEquals(parseDfDiskRows(output, 3).map((disk) => disk.mount), ["/c", "/a", "/b"]);
});
