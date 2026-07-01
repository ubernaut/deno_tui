// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import { createThemeProvider, createThemeRegistry, ThemeProvider } from "../src/theme.ts";
import { ThemeProviderImplementation } from "../src/theme_provider.ts";

Deno.test("theme provider module backs the public facade class", async () => {
  const store = new MemoryStore<string>();
  await store.set("theme.active", "ops");

  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", label: "Plain", options: {} },
      {
        id: "ops",
        label: "Ops",
        options: {
          tokens: { accent: (text) => `!${text}!` },
          components: { button: { base: { active: "accent" } } },
        },
      },
    ]),
    store,
  });

  assertInstanceOf(provider, ThemeProvider);
  assertInstanceOf(provider, ThemeProviderImplementation);
  assertEquals(await provider.ready, "ops");
  assertEquals(provider.activeId.peek(), "ops");
  assertEquals(provider.resolve("button", "active").peek()("go"), "!go!");

  provider.previousTheme();
  await provider.flush();
  assertEquals(await store.get("theme.active"), "plain");
});

Deno.test("theme provider reset clears persisted active theme", async () => {
  const store = new MemoryStore<string>();
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", label: "Plain", options: {} },
      { id: "ops", label: "Ops", options: {} },
    ]),
    activeId: "ops",
    store,
  });

  await provider.flush();
  provider.setTheme("plain");
  provider.setTheme("ops");
  await provider.flush();
  assertEquals(await store.get("theme.active"), "ops");
  assertEquals(await provider.resetTheme("plain"), true);
  assertEquals(provider.activeId.peek(), "plain");
  assertEquals(await store.get("theme.active"), undefined);
});
