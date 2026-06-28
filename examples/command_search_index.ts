import {
  type Action,
  AsyncScheduler,
  CommandRegistry,
  createIndexedCommandSurface,
  searchCommandSearchIndex,
} from "../mod.ts";

type DemoAction = Action<"demo.command", { id: string }>;

const registry = new CommandRegistry<DemoAction>();
const actions: DemoAction[] = [];

for (const group of ["routes", "theme", "runtime", "widgets"]) {
  for (let index = 0; index < 40; index += 1) {
    registry.register({
      id: `${group}.command.${index}`,
      label: `${title(group)} Command ${index}`,
      description: `Generated ${group} command ${index}`,
      group,
      keywords: [group, index % 2 === 0 ? "even" : "odd", index % 5 === 0 ? "priority" : "bulk"],
      disabled: index % 17 === 0,
      action: { type: "demo.command", payload: { id: `${group}.command.${index}` } },
    });
  }
}

const scheduler = new AsyncScheduler({ concurrency: 1 });
const surface = createIndexedCommandSurface(registry, (action) => void actions.push(action), {
  scheduler,
  query: "runtime priority",
  limit: 6,
});

console.log("Indexed command search demo");
console.log(`Index: ${surface.inspect().count} commands, ${surface.inspect().fieldCount} fields`);
console.log("Initial matches:");
for (const match of surface.matches.peek()) {
  console.log(`- ${match.item.id} score=${match.score} matched=${match.matched.join(", ")}`);
}

registry.register({
  id: "runtime.profile.accelerated",
  label: "Accelerated Runtime Profile",
  group: "runtime",
  keywords: ["runtime", "profile", "gpu", "workers", "priority"],
  action: { type: "demo.command", payload: { id: "runtime.profile.accelerated" } },
});
await surface.refresh({ priority: 10 });

console.log("");
console.log("After scheduler refresh:");
for (const match of surface.setQuery("gpu workers")) {
  console.log(`- ${match.item.id} score=${match.score}`);
}

await surface.execute({ id: "runtime.profile.accelerated" });
console.log("");
console.log(`Executed actions: ${actions.map((action) => action.payload?.id).join(", ")}`);
console.log(`Scheduler idle: ${scheduler.inspect().idle}`);

console.log("");
console.log("One-off indexed lookup:");
const lookup = searchCommandSearchIndex(surface.index.peek(), "theme even", { limit: 3 });
for (const match of lookup) {
  console.log(`- ${match.item.id}`);
}

surface.dispose();

function title(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
