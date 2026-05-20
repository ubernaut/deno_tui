export * from "./grwizard_immediate.ts";

import { main } from "./grwizard_immediate.ts";

if (import.meta.main) {
  await main();
}
