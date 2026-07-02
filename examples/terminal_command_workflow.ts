import {
  type Action,
  bindTerminalWorkspaceCommands,
  CommandRegistry,
  commandSurfaceItems,
  commandTerminalTemplate,
  createTerminalPlan,
  createTerminalSessionController,
  createTerminalWorkspaceController,
  detectTerminalCapabilities,
  executeCommandSurfaceItem,
  formatTerminalPlan,
  rankCommandSurfaceItems,
  shellTerminalTemplate,
  terminalSessionSequences,
  type TerminalWorkspaceCommandAction,
} from "../mod.ts";

type DemoAction =
  | Action<"route.open", { route: string }>
  | Action<"session.entered", { bytes: number }>
  | Action<"session.exited", { bytes: number }>
  | TerminalWorkspaceCommandAction;

const terminalPlan = createTerminalPlan(detectTerminalCapabilities(), {
  preferAlternateScreen: true,
  preferBracketedPaste: true,
  preferMouse: true,
});
const sequences = terminalSessionSequences({ plan: terminalPlan });
const writes: string[] = [];
const writer = {
  write(data: Uint8Array) {
    writes.push(new TextDecoder().decode(data));
    return data.byteLength;
  },
};
const session = createTerminalSessionController(writer, { plan: terminalPlan });
const workspace = createTerminalWorkspaceController({ now: () => 1 });
workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash", columns: 100, rows: 30 }));
workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f", "app.log"] }));
const registry = new CommandRegistry<DemoAction>();
const events: string[] = [];

registry.registerAll([
  {
    id: "route.overview",
    label: "Open Overview",
    group: "routes",
    keywords: ["home", "dashboard"],
    binding: { key: "1" },
    action: { type: "route.open", payload: { route: "overview" } },
  },
  {
    id: "route.runtime",
    label: "Open Runtime",
    group: "routes",
    keywords: ["workers", "webgpu", "terminal"],
    binding: { key: "2" },
    action: { type: "route.open", payload: { route: "runtime" } },
  },
  {
    id: "session.enter",
    label: "Enter Terminal Session",
    group: "terminal",
    keywords: ["alternate screen", "mouse", "paste"],
    action: async () => {
      await session.enter();
      return { type: "session.entered", payload: { bytes: sequences.enter.length } };
    },
  },
  {
    id: "session.exit",
    label: "Exit Terminal Session",
    group: "terminal",
    keywords: ["restore", "cursor"],
    disabled: () => !session.active,
    action: async () => {
      await session.exit();
      return { type: "session.exited", payload: { bytes: sequences.exit.length } };
    },
  },
]);

bindTerminalWorkspaceCommands(registry, workspace, {
  id: "workspace",
  idPrefix: "workspace",
  group: "workspace",
  sessionId: () => workspace.inspect().activeId,
  renameTitle: "Build Logs",
});

const dispatch = (action: DemoAction) => {
  switch (action.type) {
    case "route.open":
      events.push(`route:${action.payload?.route ?? "unknown"}`);
      break;
    case "session.entered":
      events.push(`entered:${action.payload?.bytes ?? 0}`);
      break;
    case "session.exited":
      events.push(`exited:${action.payload?.bytes ?? 0}`);
      break;
    case "terminalWorkspace.sessionActivated":
      events.push(`workspace-active:${action.payload?.sessionId ?? "none"}`);
      break;
    case "terminalWorkspace.sessionRenamed":
      events.push(`workspace-renamed:${action.payload?.sessionId ?? "none"}`);
      break;
    case "terminalWorkspace.sessionMoved":
      events.push(`workspace-moved:${action.payload?.sessionId ?? "none"}:${action.payload?.delta ?? 0}`);
      break;
    case "terminalWorkspace.sessionClosed":
      events.push(`workspace-closed:${action.payload?.sessionId ?? "none"}`);
      break;
    default:
      events.push(action.type);
      break;
  }
};

const ranked = rankCommandSurfaceItems(commandSurfaceItems(registry), "alternate screen", { limit: 3 });
await executeCommandSurfaceItem(registry, ranked[0]!.item, dispatch);
await registry.execute("session.exit", dispatch);
await registry.execute("route.runtime", dispatch);
await registry.execute("workspace.nextSession", dispatch);
await registry.execute("workspace.previousSession", dispatch);
await registry.execute("workspace.renameSession", dispatch);
await registry.execute("workspace.moveSessionNext", dispatch);

console.log("# Terminal Command Workflow Demo");
console.log("");
console.log(formatTerminalPlan(terminalPlan));
console.log("");
console.log(`Enter bytes: ${sequences.enter.length}`);
console.log(`Exit bytes: ${sequences.exit.length}`);
console.log(`Session active: ${session.inspect().active}`);
console.log(`Mouse protocol: ${session.inspect().mouseProtocol}`);
console.log(`Writes captured: ${writes.length}`);
console.log(
  `Commands: ${registry.inspect().count}, enabled: ${registry.inspect().enabled}, groups: ${
    registry.inspect().groups.join(", ")
  }`,
);
console.log(`Ranked terminal hits: ${ranked.map((match) => `${match.item.id}:${match.score}`).join(", ")}`);
console.log(`Workspace active: ${workspace.inspect().activeId}`);
console.log(`Workspace sessions: ${workspace.inspect().sessions.map((item) => `${item.id}:${item.title}`).join(", ")}`);
console.log(`Events: ${events.join(", ")}`);
