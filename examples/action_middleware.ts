import { ActionBus, createAppPlugin } from "../mod.ts";

type DemoAction =
  | { type: "route"; payload: string }
  | { type: "route.alias"; payload: string }
  | { type: "blocked"; payload: string };

const bus = new ActionBus<DemoAction>();
const seen: string[] = [];

bus.use(async (action, next) => {
  seen.push(`middleware:${action.type}`);
  if (action.type === "blocked") return;
  await next(action.type === "route.alias" ? { type: "route", payload: action.payload } : action);
});

bus.subscribeType("route", (action) => {
  seen.push(`handler:${action.payload}`);
});

await bus.dispatch({ type: "route.alias", payload: "overview" });
await bus.dispatch({ type: "blocked", payload: "admin" });

const plugin = createAppPlugin<DemoAction>({
  id: "routing",
  label: "Routing Middleware",
  actionMiddleware: [
    (action, next) => next(action.type === "route.alias" ? { type: "route", payload: action.payload } : action),
  ],
});

console.log("Action middleware demo");
for (const entry of seen) {
  console.log(`- ${entry}`);
}
console.log(`bus: ${JSON.stringify(bus.inspect())}`);
console.log(`plugin: ${JSON.stringify({ id: plugin.id, label: plugin.label })}`);
