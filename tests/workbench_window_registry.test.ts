import { assertEquals } from "./deps.ts";
import {
  createWorkbenchVisualizationWindowOptions,
  createWorkbenchWindowOptions,
  isWorkbenchVisualizationWindowId,
  isWorkbenchWindowOptionLoaded,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  workbenchWindowOptionMenuLabel,
  workbenchWindowOptionMinimums,
} from "../src/app/workbench_window_registry.ts";

Deno.test("workbench window registry projects visualization metadata into launcher options", () => {
  const options = createWorkbenchVisualizationWindowOptions([
    { id: "cpu-hex-grid", name: "CPU Hex Grid", description: "cores", family: "monitor" },
    { id: "magi-board", name: "MAGI Board", description: "neon", family: "neon" },
    { id: "eva-lattice", name: "Lattice", description: "3d", family: "neon3d" },
  ]);

  assertEquals(options.map((option) => option.group), ["Monitor", "Neon", "Neon 3D"]);
  assertEquals(options[0]?.label, "CPU Hex Grid");
});

Deno.test("workbench window registry keeps legacy visualization grouping fallback", () => {
  assertEquals(
    createWorkbenchVisualizationWindowOptions([
      { id: "three-lattice", name: "Lattice", description: "3d" },
      { id: "magi-board", name: "MAGI Board", description: "neon" },
    ], new Set(["magi-board"])).map((option) => option.group),
    ["Neon 3D", "Neon"],
  );
});

Deno.test("workbench window registry keeps built-ins ahead of visualization options", () => {
  const options = createWorkbenchWindowOptions({
    builtIns: [{ id: "shell", label: "Shell", group: "Terminal", description: "pty", windowId: "terminalShell" }],
    visualizations: [{ id: "network-monitor", name: "Network", description: "io" }],
  });

  assertEquals(options.map((option) => option.id), ["shell", "network-monitor"]);
  assertEquals(options[0]?.windowId, "terminalShell");
});

Deno.test("workbench window registry normalizes visualization window ids and loaded state", () => {
  const id = workbenchVisualizationWindowId("CPU Hex Grid!!");
  const option = { id: "CPU Hex Grid!!", label: "CPU", group: "Monitor" as const, description: "cores" };

  assertEquals(id, "viz:cpu-hex-grid--");
  assertEquals(isWorkbenchVisualizationWindowId(id), true);
  assertEquals(workbenchVisualizationIdFromWindowId(id), "cpu-hex-grid--");
  assertEquals(isWorkbenchWindowOptionLoaded(option, [id]), true);
  assertEquals(isWorkbenchWindowOptionLoaded({ ...option, windowId: "cpu" }, ["cpu"]), true);
});

Deno.test("workbench window registry formats labels and option minimums", () => {
  assertEquals(
    workbenchWindowOptionMenuLabel(
      { id: "three-lattice", label: "Lattice", group: "Neon 3D", description: "3d" },
      true,
    ),
    "[x] Neon 3D: Lattice",
  );
  assertEquals(
    workbenchWindowOptionMinimums({ id: "gpu-chip-monitor", label: "GPU", group: "Monitor", description: "gpu" }),
    { minWidth: 40, minHeight: 13 },
  );
  assertEquals(
    workbenchWindowOptionMinimums({ id: "three-lattice", label: "Lattice", group: "Neon 3D", description: "3d" }),
    { minWidth: 42, minHeight: 16 },
  );
});
