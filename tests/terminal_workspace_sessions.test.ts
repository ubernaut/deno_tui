import { assertEquals, assertNotStrictEquals } from "./deps.ts";
import {
  attachTerminalTemplate,
  commandTerminalTemplate,
  type TerminalSessionDescriptor,
} from "../src/runtime/terminal_templates.ts";
import {
  cloneTerminalSessionDescriptor,
  descriptorFromTerminalTemplate,
  duplicateTerminalSessionDescriptor,
  shouldAdoptRuntimeTitle,
} from "../src/runtime/terminal_workspace_sessions.ts";

Deno.test("terminal workspace session descriptors materialize spawn templates", () => {
  const template = commandTerminalTemplate({
    id: "tail-logs",
    title: "Tail Logs",
    command: "tail",
    args: ["-f", "server.log"],
    cwd: "/repo",
    env: { FORCE_COLOR: "1" },
    columns: 100.8,
    rows: 24.2,
    reconnectable: true,
    restartPolicy: "on-failure",
    metadata: { role: "logs" },
  });

  const descriptor = descriptorFromTerminalTemplate(template, {
    title: "Runtime Logs",
    backendId: "pty",
    rows: 40.9,
    status: "running",
    running: true,
  }, 123);

  assertEquals(descriptor.id, "tail-logs");
  assertEquals(descriptor.title, "Runtime Logs");
  assertEquals(descriptor.backendId, "pty");
  assertEquals(descriptor.commandLine, "tail -f server.log");
  assertEquals(descriptor.status, "running");
  assertEquals(descriptor.running, true);
  assertEquals(descriptor.columns, 100);
  assertEquals(descriptor.rows, 40);
  assertEquals(descriptor.reconnectable, true);
  assertEquals(descriptor.restartPolicy, "on-failure");
  assertEquals(descriptor.createdAt, 123);
  assertEquals(descriptor.updatedAt, 123);
  assertEquals(descriptor.template, template);
  assertNotStrictEquals(descriptor.template, template);
});

Deno.test("terminal workspace session descriptors materialize attach templates", () => {
  const template = attachTerminalTemplate("pty/server", {
    title: "Server Attach",
    metadata: { host: "local" },
  });

  const descriptor = descriptorFromTerminalTemplate(template, {
    backendId: "remote",
    columns: 0,
    rows: Number.NaN,
    status: "running",
    running: true,
  }, 99);

  assertEquals(descriptor.id, "attach-pty-server");
  assertEquals(descriptor.title, "Server Attach");
  assertEquals(descriptor.backendId, "remote");
  assertEquals(descriptor.columns, 1);
  assertEquals(descriptor.rows, undefined);
  assertEquals(descriptor.status, "running");
  assertEquals(descriptor.running, true);
  assertEquals(descriptor.detached, false);
  assertEquals(descriptor.reconnectable, true);
  assertEquals(descriptor.restartPolicy, "never");
});

Deno.test("terminal workspace session descriptors clone nested template state", () => {
  const descriptor = descriptorFromTerminalTemplate(
    commandTerminalTemplate({
      id: "shell",
      title: "Shell",
      command: "bash",
      args: ["-l"],
      env: { TERM: "xterm-256color" },
      metadata: { lane: "dev" },
    }),
    {},
    10,
  );

  const clone = cloneTerminalSessionDescriptor(descriptor);
  assertEquals(clone, descriptor);
  assertNotStrictEquals(clone, descriptor);
  assertNotStrictEquals(clone.template, descriptor.template);

  const originalTemplate = descriptor.template;
  if (originalTemplate.kind === "attach") throw new Error("expected spawn template");
  const clonedTemplate = clone.template;
  if (clonedTemplate.kind === "attach") throw new Error("expected spawn template");
  (clonedTemplate.args as string[] | undefined)?.push("--noprofile");
  clonedTemplate.env!.TERM = "screen-256color";
  clonedTemplate.metadata!.lane = "ops";

  assertEquals(originalTemplate.args, ["-l"]);
  assertEquals(originalTemplate.env, { TERM: "xterm-256color" });
  assertEquals(originalTemplate.metadata, { lane: "dev" });
});

Deno.test("terminal workspace session descriptors duplicate with unique sanitized ids", () => {
  const source = descriptorFromTerminalTemplate(
    commandTerminalTemplate({
      id: "dev server",
      title: "Dev Server",
      command: "deno",
      args: ["task", "dev"],
      reconnectable: true,
    }),
    {
      backendId: "pty",
      status: "running",
      running: true,
    },
    10,
  );

  const duplicate = duplicateTerminalSessionDescriptor(
    source,
    [source, { ...source, id: "dev-server-copy" }],
    {},
    20,
  );

  assertEquals(duplicate.id, "dev-server-copy-2");
  assertEquals(duplicate.title, "Dev Server Copy");
  assertEquals(duplicate.template.id, "dev-server-copy-2");
  assertEquals(duplicate.template.title, "Dev Server Copy");
  assertEquals(duplicate.backendId, "pty");
  assertEquals(duplicate.status, "idle");
  assertEquals(duplicate.running, false);
  assertEquals(duplicate.detached, false);
  assertEquals(duplicate.commandLine, "deno task dev");
  assertEquals(duplicate.createdAt, 20);
  assertEquals(duplicate.updatedAt, 20);
});

Deno.test("terminal workspace session descriptors preserve attached duplicate runtime state", () => {
  const source = descriptorFromTerminalTemplate(attachTerminalTemplate("server-1"), {
    status: "running",
    running: true,
  }, 10);

  const duplicate = duplicateTerminalSessionDescriptor(source, [source], {
    id: "server clone",
    title: "Server Clone",
  }, 20);

  assertEquals(duplicate.id, "server-clone");
  assertEquals(duplicate.title, "Server Clone");
  assertEquals(duplicate.template.id, "server-clone");
  assertEquals(duplicate.template.title, "Server Clone");
  assertEquals(duplicate.status, "running");
  assertEquals(duplicate.running, true);
  assertEquals(duplicate.detached, false);
  assertEquals(duplicate.createdAt, 20);
  assertEquals(duplicate.updatedAt, 20);
});

Deno.test("terminal workspace session descriptors gate runtime title adoption", () => {
  const descriptor: TerminalSessionDescriptor = descriptorFromTerminalTemplate(
    commandTerminalTemplate({
      id: "shell",
      title: "Shell",
      command: "bash",
    }),
    {},
    10,
  );

  assertEquals(shouldAdoptRuntimeTitle(descriptor, undefined), true);
  assertEquals(shouldAdoptRuntimeTitle({ ...descriptor, title: "vim", runtimeTitle: "vim" }, "repo"), true);
  assertEquals(shouldAdoptRuntimeTitle({ ...descriptor, title: "repo", runtimeTitle: "vim" }, "repo"), true);
  assertEquals(shouldAdoptRuntimeTitle({ ...descriptor, title: "Manual", runtimeTitle: "vim" }, "repo"), false);
});
