export interface WorkbenchThreeWindowEntry<Id extends string = string> {
  id: Id;
}

export type WorkbenchThreeWindowStateSource<Id extends string = string> = Id | WorkbenchThreeWindowEntry<Id>;

export interface WorkbenchThreeWindowStateInput<Id extends string = string> {
  activeId: Id;
  fullscreenId?: Id | null;
  windows: readonly WorkbenchThreeWindowStateSource<string>[];
  isThreeWindow: (id: Id) => boolean;
  blocked?: boolean;
}

export interface WorkbenchThreeWindowState<Id extends string = string> {
  activeId: Id;
  fullscreenId: Id | null;
  fullscreenThree: boolean;
  live: boolean;
  blocked: boolean;
  threeWindowCount: number;
  interactiveIds: ReadonlySet<Id>;
}

/** Resolves the shared Three-window runtime state once per workbench frame. */
export function resolveWorkbenchThreeWindowState<Id extends string = string>(
  input: WorkbenchThreeWindowStateInput<Id>,
): WorkbenchThreeWindowState<Id> {
  const fullscreenId = input.fullscreenId ?? null;
  const blocked = input.blocked ?? false;
  const interactiveIds = new Set<Id>();
  let threeWindowCount = 0;
  let fullscreenThree = false;

  for (const source of input.windows) {
    const id = workbenchThreeWindowStateSourceId(source);
    if (!input.isThreeWindow(id as Id)) continue;
    threeWindowCount += 1;
    if (id === fullscreenId) fullscreenThree = true;
  }

  if (!blocked) {
    if (fullscreenThree && fullscreenId) {
      interactiveIds.add(fullscreenId);
    } else if (input.isThreeWindow(input.activeId)) {
      interactiveIds.add(input.activeId);
    }
  }

  return {
    activeId: input.activeId,
    fullscreenId,
    fullscreenThree,
    live: !blocked && (fullscreenThree || threeWindowCount > 0),
    blocked,
    threeWindowCount,
    interactiveIds,
  };
}

function workbenchThreeWindowStateSourceId<Id extends string>(source: WorkbenchThreeWindowStateSource<Id>): Id {
  return typeof source === "string" ? source : source.id;
}

export function workbenchThreeWindowStateIsInteractive<Id extends string>(
  state: Pick<WorkbenchThreeWindowState<Id>, "interactiveIds">,
  id: Id,
): boolean {
  return state.interactiveIds.has(id);
}
