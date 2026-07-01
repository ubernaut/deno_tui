import { assertEquals } from "./deps.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import {
  createStorageFallbackDiagnostic,
  formatStorageErrorDetail,
  StorageFallbackDiagnostics,
} from "../src/runtime/storage_diagnostics.ts";

Deno.test("createStorageFallbackDiagnostic formats stable storage failure codes", () => {
  const diagnostic = createStorageFallbackDiagnostic({
    source: "web-workbench",
    storage: "IndexedDB",
    operation: "workspace persist",
    error: new Error("blocked"),
    context: { workspace: "default" },
  });

  assertEquals(diagnostic, {
    source: "web-workbench",
    code: "indexeddb-workspace-persist-failed",
    severity: "warning",
    message: "IndexedDB workspace persist failed; continuing with in-memory state.",
    detail: "blocked",
    context: {
      storage: "IndexedDB",
      operation: "workspace persist",
      workspace: "default",
    },
  });
});

Deno.test("StorageFallbackDiagnostics suppresses duplicate fallback chatter", () => {
  const diagnostics = new DiagnosticsCollector();
  const storage = new StorageFallbackDiagnostics(diagnostics);

  const first = storage.report({
    source: "demo",
    storage: "localStorage",
    operation: "read",
    error: "denied",
  });
  const second = storage.report({
    source: "demo",
    storage: "localStorage",
    operation: "read",
    error: "denied",
  });

  assertEquals(first?.code, "localstorage-read-failed");
  assertEquals(second, undefined);
  assertEquals(diagnostics.inspect().count, 1);
});

Deno.test("formatStorageErrorDetail handles unknown exception values", () => {
  assertEquals(formatStorageErrorDetail(null), undefined);
  assertEquals(formatStorageErrorDetail("quota"), "quota");
  assertEquals(formatStorageErrorDetail({ name: "QuotaExceededError" }), '{"name":"QuotaExceededError"}');
});
