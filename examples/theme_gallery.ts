import {
  createAnsiStyle,
  createThemeGallery,
  createThemeProvider,
  createThemeRegistry,
  filterThemeGalleryItems,
  type ThemePack,
} from "../mod.ts";

const brokenPack = {
  id: "broken-pack",
  label: "Broken Pack",
  palette: "plain",
  options: {
    components: {
      Badge: { base: { base: "missing-token" } },
    },
  },
} as unknown as ThemePack;

const provider = createThemeProvider({
  registry: createThemeRegistry([
    {
      id: "ops-neon",
      label: "Ops Neon",
      palette: "neon",
      options: {
        components: {
          Button: {
            base: { base: "foreground", focused: "accent" },
            variants: { danger: { active: "danger" } },
          },
          StatusBar: {
            base: { base: ["surface", "foreground"], active: ["surface", "accent"] },
          },
        },
      },
    },
    {
      id: "field-console",
      label: "Field Console",
      palette: "terminal",
      options: {
        tokens: {
          accent: createAnsiStyle({ foreground: "brightCyan", bold: true }),
        },
        components: {
          Button: { base: { focused: "accent" } },
          Input: { base: { base: "foreground", focused: "accent" } },
        },
      },
    },
    brokenPack,
  ]),
  activeId: "ops-neon",
  layers: [
    {
      id: "accessibility",
      label: "Accessibility",
      options: {
        components: {
          Button: { variants: { high: { base: "warning" } } },
        },
      },
    },
  ],
});

const query = Deno.args.join(" ");
const gallery = createThemeGallery(provider, {
  query,
  sample: "LIVE",
  tokens: ["foreground", "accent", "warning"],
  components: ["Button", "StatusBar"],
  states: ["base", "focused", "active"],
});

console.log("Theme gallery demo");
console.log(`active=${gallery.activeId} query=${query || "(none)"}`);
console.log("");

for (const match of gallery.matches) {
  const item = match.item;
  console.log(
    `- ${
      item.active ? "*" : " "
    } ${item.id}: ${item.label} palette=${item.palette} valid=${item.valid} score=${match.score}`,
  );
  console.log(`  layers=${item.activeLayers.join(", ") || "none"}`);
  console.log(`  matched=${match.matched.join(", ") || "none"}`);
  for (const token of item.preview.tokens) {
    console.log(`  token ${token.token}: ${token.preview.styled}`);
  }
  for (const preview of item.preview.components.slice(0, 4)) {
    console.log(`  ${preview.component}/${preview.variant}/${preview.state}: ${preview.preview.styled}`);
  }
  if (!item.valid) {
    console.log(`  issues=${item.issues.map((issue) => issue.message).join("; ")}`);
  }
}

console.log("");
console.log(
  `Quick filter "console": ${filterThemeGalleryItems(gallery.items, "console").map((item) => item.id).join(", ")}`,
);
