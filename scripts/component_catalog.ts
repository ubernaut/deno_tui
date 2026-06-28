import {
  type ComponentCapability,
  type ComponentCatalogQuery,
  type ComponentCategory,
  createComponentCatalogReport,
  formatComponentCatalogMarkdown,
} from "../mod.ts";

const args = new Set(Deno.args);
const query = parseQuery(Deno.args);

if (args.has("--json")) {
  console.log(JSON.stringify(createComponentCatalogReport({ query }), null, 2));
} else {
  console.log(formatComponentCatalogMarkdown({ query }));
}

function parseQuery(args: readonly string[]): ComponentCatalogQuery {
  const query: ComponentCatalogQuery = {};
  for (const arg of args) {
    const [name, value] = arg.split("=", 2);
    if (!value) continue;
    if (name === "--category") {
      query.category = value as ComponentCategory;
    } else if (name === "--capability") {
      query.capability = value as ComponentCapability;
    } else if (name === "--search") {
      query.search = value;
    }
  }
  return query;
}
