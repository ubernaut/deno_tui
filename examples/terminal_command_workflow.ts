import {
  type Action,
  CommandRegistry,
  commandSurfaceItems,
  createTerminalPlan,
  createTerminalSessionController,
  detectTerminalCapabilities,
  executeCommandSurfaceItem,
  formatTerminalPlan,
  rankCommandSurfaceItems,
  terminalSessionSequences,
} from "../mod.ts";

type DemoAction =
  | Action<"route.open", { route: string }>
  | Action<"session.entered", { bytes: number }>
  | Action<"session.exited", { bytes: number }>;

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
  }
};

const ranked = rankCommandSurfaceItems(commandSurfaceItems(registry), "terminal", { limit: 3 });
await executeCommandSurfaceItem(registry, ranked[0]!.item, dispatch);
await registry.execute("session.exit", dispatch);
await registry.execute("route.runtime", dispatch);

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
console.log(`Events: ${events.join(", ")}`);
