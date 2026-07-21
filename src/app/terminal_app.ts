// Copyright 2023 Im-Beast. MIT license.
import type { Component } from "../component.ts";
import type { Focusable, FocusNavigationOptions } from "../focus.ts";
import { emitInputEvents } from "../input_reader/mod.ts";
import type { KeyBinding } from "../keymap.ts";
import type { RuntimeWorkloadSource } from "../runtime/telemetry.ts";
import type { Tui } from "../tui.ts";
import { isInteractable } from "../utils/component.ts";
import type { Action, ActionHandler, ActionMiddleware } from "./actions.ts";
import { type AppPluginDisposer, type AppPluginInstaller, TuiApp, type TuiAppOptions } from "./app.ts";
import type { CommandKeyBindingOptions, CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { Command } from "./commands.ts";
import type { MouseInteractionTarget } from "./mouse_bindings.ts";
import { createAppPlugin } from "./plugins.ts";
import type { Route } from "./router.ts";

/** Default interaction bindings installed by an opinionated terminal app. */
export interface TerminalAppBindings {
  commandKeys?: boolean | CommandKeyBindingOptions;
  commandKeymap?: boolean | CommandKeymapBindingOptions;
  focusNavigation?: boolean | FocusNavigationOptions;
  mouse?: boolean;
}

/** Options for registering a mounted component with app-level focus and mouse routing. */
export interface TerminalAppComponentOptions {
  id?: string;
  focus?: boolean;
  mouse?: boolean;
}

/** Input-loop behavior owned by an opinionated terminal app. */
export interface TerminalAppInputOptions {
  /** Optional delay after a successful read; blocking terminal input defaults to no throttle. */
  minReadInterval?: number;
  restoreRawMode?: boolean;
  onError?: (error: unknown) => void;
}

/** Declarative options for the focused terminal application entrypoint. */
export interface TerminalAppOptions<TAction extends Action = Action, TRoute extends Route = Route>
  extends TuiAppOptions<TRoute> {
  id?: string;
  label?: string;
  commands?: readonly Command<TAction>[];
  keyBindings?: readonly KeyBinding[];
  focusItems?: readonly Focusable[];
  mouseTargets?: readonly MouseInteractionTarget[];
  workloadSources?: readonly RuntimeWorkloadSource[];
  actionMiddleware?: readonly ActionMiddleware<TAction>[];
  plugins?: readonly AppPluginInstaller<TAction, TRoute>[];
  onAction?: ActionHandler<TAction>;
  setup?: (app: TerminalApp<TAction, TRoute>) => AppPluginDisposer;
  bindings?: TerminalAppBindings;
  input?: boolean | TerminalAppInputOptions;
  exitOnSignal?: boolean;
}

/** Opinionated application shell that installs common interaction and lifecycle wiring. */
export class TerminalApp<TAction extends Action = Action, TRoute extends Route = Route>
  extends TuiApp<TAction, TRoute> {
  readonly #input: boolean | TerminalAppInputOptions;
  readonly #exitOnSignal: boolean;
  #started = false;
  #destroyed = false;
  #componentSequence = 0;

  constructor(options: TerminalAppOptions<TAction, TRoute> = {}) {
    const bindings = options.bindings ?? {};
    const mouseEnabled = bindingEnabled(bindings.mouse, true);
    super({
      tui: options.tui,
      tuiOptions: {
        ...options.tuiOptions,
        enableMouse: options.tuiOptions?.enableMouse ?? mouseEnabled,
        enableBracketedPaste: options.tuiOptions?.enableBracketedPaste ?? true,
        enableFocusEvents: options.tuiOptions?.enableFocusEvents ?? true,
      },
      routes: options.routes,
      initialRouteId: options.initialRouteId,
    });

    this.#input = options.input ?? true;
    this.#exitOnSignal = options.exitOnSignal ?? true;

    this.use(createAppPlugin({
      id: options.id,
      label: options.label,
      commands: options.commands,
      keyBindings: options.keyBindings,
      focusItems: options.focusItems,
      mouseTargets: options.mouseTargets,
      workloadSources: options.workloadSources,
      actionMiddleware: options.actionMiddleware,
    }));
    if (options.plugins?.length) this.useAll(options.plugins);
    if (options.onAction) this.onAction(options.onAction);

    const commandKeys = bindingOptions(bindings.commandKeys, true);
    if (commandKeys) this.enableCommandKeys(commandKeys);
    const commandKeymap = bindingOptions(bindings.commandKeymap, true);
    if (commandKeymap) this.enableCommandKeymap(commandKeymap);
    const focusNavigation = bindingOptions(bindings.focusNavigation, true);
    if (focusNavigation) this.enableFocusNavigation(focusNavigation);
    if (mouseEnabled) this.enableMouseInteractions();

    const setupDisposer = options.setup?.(this);
    if (setupDisposer) this.onDispose(setupDisposer);
  }

  /** Returns whether this app has started its terminal render lifecycle. */
  get started(): boolean {
    return this.#started;
  }

  /** Registers a mounted component with focus traversal and pointer routing. */
  registerComponent(component: Component, options: TerminalAppComponentOptions = {}): () => void {
    const interactable = isInteractable(component);
    const disposers: Array<() => void> = [];
    if (options.focus ?? interactable) {
      disposers.push(this.focus.register(component));
    }
    if (options.mouse ?? interactable) {
      disposers.push(this.mouse.register({
        id: options.id ?? `component-${this.#componentSequence++}`,
        bounds: () => component.rectangle.peek(),
        zIndex: () => component.zIndex.peek(),
        disabled: () => !component.visible.peek() || component.state.peek() === "disabled",
        onPress: () => {
          this.focus.focus(component);
          component.interact("mouse");
          if (interactable && component.state.peek() === "focused") component.interact("mouse");
          return true;
        },
        onDrag: () => {
          this.focus.focus(component);
          return true;
        },
        onRelease: () => {
          if (component.state.peek() === "active") component.state.value = "focused";
          return true;
        },
        onScroll: () => {
          this.focus.focus(component);
          return true;
        },
      }));
    }

    let active = true;
    let stopDestroy: () => void = () => {};
    const dispose = () => {
      if (!active) return;
      active = false;
      stopDestroy();
      for (let index = disposers.length - 1; index >= 0; index -= 1) disposers[index]!();
    };
    stopDestroy = component.on("destroy", dispose);
    return this.onDispose(dispose);
  }

  /** Starts input, signal handling, and terminal rendering once. */
  override start(): void {
    if (this.#started || this.#destroyed) return;
    this.#started = true;
    if (this.#input !== false) {
      this.onDispose(bindTerminalInput(this.tui, this.#input === true ? {} : this.#input));
    }
    if (this.#exitOnSignal) this.tui.dispatch();
    this.tui.run();
  }

  /** Destroys the terminal app and marks its lifecycle as stopped. */
  override destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#started = false;
    super.destroy();
  }
}

/** Creates an opinionated terminal app from one declarative definition. */
export function createTerminalApp<TAction extends Action = Action, TRoute extends Route = Route>(
  options: TerminalAppOptions<TAction, TRoute> = {},
): TerminalApp<TAction, TRoute> {
  return new TerminalApp<TAction, TRoute>(options);
}

function bindingEnabled(value: boolean | undefined, fallback: boolean): boolean {
  return value ?? fallback;
}

function bindingOptions<TOptions extends object>(
  value: boolean | TOptions | undefined,
  fallback: boolean,
): TOptions | undefined {
  if (value === false || (value === undefined && !fallback)) return undefined;
  return typeof value === "object" ? value : {} as TOptions;
}

function bindTerminalInput(tui: Tui, options: TerminalAppInputOptions): () => void {
  const controller = new AbortController();
  let active = true;
  let unbindDestroy: () => void = () => {};
  const stop = () => {
    if (!active) return;
    active = false;
    controller.abort();
    unbindDestroy();
    if (options.restoreRawMode ?? true) {
      try {
        tui.stdin.setRaw(false);
      } catch { /**/ }
    }
  };
  unbindDestroy = tui.on("destroy", stop);
  void emitInputEvents(
    tui.stdin,
    tui,
    options.minReadInterval ?? 0,
    { signal: controller.signal },
  ).catch((error) => {
    if (!controller.signal.aborted) options.onError?.(error);
  });
  return stop;
}
