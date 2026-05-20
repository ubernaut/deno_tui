import { join, relative, resolve } from "https://deno.land/std@0.192.0/path/mod.ts";

export type ModelFit = "good" | "stretch" | "unlikely" | "cpu-only";
export type CalibrationProfileId = "standard" | "heavy";

export interface HardwareSummary {
  cpuCores: number;
  systemRamGb: number;
  gpuPresent: boolean;
  gpuName: string;
  gpuVramGb: number;
  deviceDefault: "cpu" | "cuda";
  hfAuthLoaded: boolean;
  dockerComposeAvailable: boolean;
}

export interface ModelCatalogEntry {
  id: string;
  label: string;
  family?: string;
  params_b?: number;
  min_vram_gb?: number;
  recommended_device?: string;
  gated?: boolean;
  requires_remote_code?: boolean;
  notes?: string;
}

export interface ModelCandidate {
  section: "local" | "huggingface";
  source: "hf-cache" | "local-dir" | "huggingface";
  fit: ModelFit;
  display: string;
  ref: string;
  containerRef: string;
  localOnly: boolean;
  remoteCode: boolean;
  gated: boolean;
  paramsB: number | null;
  minVramGb: number | null;
  notes: string;
  modelId: string;
  family: string;
}

export interface GoalPreset {
  name: string;
  label: string;
  template: string;
  threshold: number;
  calTokens: number;
  proxyTokens: number;
  sweeps: number;
  strict: boolean;
  autonomous: boolean;
  monitorInterval: number;
  description: string;
}

export interface CalibrationProfile {
  id: CalibrationProfileId;
  label: string;
  description: string;
}

export interface AppliedCalibration {
  id: CalibrationProfileId;
  label: string;
  description: string;
  effectiveCalTokens: number;
  effectiveProxyTokens: number;
}

export interface GeoRefineContext {
  rootDir: string;
  wizardDir: string;
  runsDir: string;
  catalogPath: string;
  localEnvPath: string;
  hardware: HardwareSummary;
  localEnv: Record<string, string>;
  catalog: ModelCatalogEntry[];
  candidates: ModelCandidate[];
  goals: GoalPreset[];
  calibrations: CalibrationProfile[];
}

export interface LaunchPlan {
  context: GeoRefineContext;
  selectedModel: ModelCandidate;
  goal: GoalPreset;
  calibration: AppliedCalibration;
  runTag: string;
  containerName: string;
  resultsRoot: string;
  compressedRoot: string;
  runRoot: string;
  swarmRuntimeRoot: string;
  agendaPathHost: string;
  containerScriptHost: string;
  progressFileHost: string;
  resultFileHost: string;
  autopilotLogHost: string;
  georefineLogHost: string;
  checkpointDirHost: string;
  saveDirHost: string;
  agendaPathContainer: string;
  containerScriptContainer: string;
  progressFileContainer: string;
  resultFileContainer: string;
  autopilotLogContainer: string;
  georefineLogContainer: string;
  checkpointDirContainer: string;
  saveDirContainer: string;
  swarmRuntimeRootContainer: string;
  successCriterion: string;
  georefineCommandArgs: string[];
  georefineCommandString: string;
  dockerArgs: string[];
}

export interface RunTask {
  id: string;
  status: string;
  type: string;
  priority: number;
  note: string;
  column: "backlog" | "active" | "review" | "done";
}

export interface RunBoard {
  backlog: RunTask[];
  active: RunTask[];
  review: RunTask[];
  done: RunTask[];
}

export interface RunProgressPhase {
  name: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  metrics: Record<string, unknown>;
  error: string | null;
}

export interface RunProgressSnapshot {
  status: string;
  currentPhase: string;
  overallProgressPct: number;
  elapsedSeconds: number;
  phases: RunProgressPhase[];
  checkpointPath: string | null;
}

export interface RunResultSnapshot {
  runStatus: string;
  artifactKind: string;
  saveDir: string | null;
  baselinePpl: number | null;
  finalPpl: number | null;
  degradation: number | null;
  qualityMetric: string | null;
  finalQuality: number | string | null;
}

export interface RunSnapshot {
  board: RunBoard;
  sharedState: Record<string, unknown>;
  autopilotStatus: Record<string, unknown> | null;
  progress: RunProgressSnapshot | null;
  result: RunResultSnapshot | null;
  checkpoint: Record<string, unknown> | null;
  currentTask: string;
  currentPhase: string;
  progressRatio: number;
  progressLabel: string;
  modelLoadRatio: number;
  dataLoadRatio: number;
  swarmState: string;
  swarmCurrent: string;
  swarmStep: string;
  activeAgents: string[];
  alerts: string[];
  outputTail: string[];
  georefineTail: string[];
  swarmTail: string[];
  resultSummary: string[];
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    name: "smoke",
    label: "Smoke Test",
    template: "minimal",
    threshold: 0.03,
    calTokens: 512,
    proxyTokens: 128,
    sweeps: 1,
    strict: false,
    autonomous: false,
    monitorInterval: 15,
    description: "Fast viability run with light calibration and search.",
  },
  {
    name: "balanced",
    label: "Balanced Run",
    template: "standard",
    threshold: 0.02,
    calTokens: 2048,
    proxyTokens: 512,
    sweeps: 2,
    strict: true,
    autonomous: false,
    monitorInterval: 20,
    description: "Default agentic pass with stricter quality handling.",
  },
  {
    name: "quality-first",
    label: "Quality First",
    template: "quality_first",
    threshold: 0.01,
    calTokens: 4096,
    proxyTokens: 1024,
    sweeps: 3,
    strict: true,
    autonomous: false,
    monitorInterval: 25,
    description: "Slower pass that pushes more calibration and guardrails.",
  },
  {
    name: "deep-search",
    label: "Deep Search",
    template: "standard",
    threshold: 0.015,
    calTokens: 4096,
    proxyTokens: 2048,
    sweeps: 4,
    strict: true,
    autonomous: false,
    monitorInterval: 30,
    description: "Wider local search for shallow-basin hunting.",
  },
  {
    name: "full-agency",
    label: "Full Agency",
    template: "quality_first",
    threshold: 0.01,
    calTokens: 4096,
    proxyTokens: 1024,
    sweeps: 3,
    strict: true,
    autonomous: true,
    monitorInterval: 30,
    description: "Autonomous mode with the full agentic controller.",
  },
];

export const CALIBRATION_PROFILES: CalibrationProfile[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Use the goal's default calibration budget.",
  },
  {
    id: "heavy",
    label: "Heavy",
    description: "Double the calibration and proxy token budgets, with larger minimum floors.",
  },
];

const HF_TOKEN_KEYS = ["HF_TOKEN", "HUGGINGFACE_HUB_TOKEN", "HUGGING_FACE_HUB_TOKEN"] as const;

const SWARM_RESET_DIRS = [
  "status",
  "logs",
  "locks",
  "results",
  "messages",
  "identities",
  "cache",
  "tasks",
] as const;

const SWARM_RESET_FILES = [
  "events.jsonl",
  "board.json",
  "shared_state.json",
  "gpu_lock.json",
  "file_locks.json",
] as const;

const phaseOrder = ["loading", "geometry", "signals", "calibration", "search", "evaluation", "export"];

export async function loadGeoRefineContext(rootOverride?: string): Promise<GeoRefineContext> {
  const rootDir = await resolveGeoRefineRoot(rootOverride);
  const wizardDir = join(rootDir, "grWizard");
  const runsDir = join(wizardDir, "runs");
  const catalogPath = join(wizardDir, "model_catalog.json");
  const localEnvPath = join(wizardDir, ".env.local");
  const localEnv = await loadLocalEnv(localEnvPath);
  const hardware = await detectHardware(localEnv, rootDir);
  const catalog = await loadModelCatalog(catalogPath);
  const candidates = await discoverModelCandidates(rootDir, catalog, hardware);

  return {
    rootDir,
    wizardDir,
    runsDir,
    catalogPath,
    localEnvPath,
    hardware,
    localEnv,
    catalog,
    candidates,
    goals: [...GOAL_PRESETS],
    calibrations: [...CALIBRATION_PROFILES],
  };
}

export async function resolveGeoRefineRoot(rootOverride?: string) {
  const candidates = [
    rootOverride,
    Deno.env.get("GEOREFINE_ROOT") ?? undefined,
    resolve(Deno.cwd(), "../GeoRefineInternal"),
    "/home/cos/projects/GeoRefineInternal",
  ].filter((entry): entry is string => Boolean(entry));

  for (const candidate of candidates) {
    const rootDir = resolve(candidate);
    try {
      const stats = await Deno.stat(join(rootDir, "grWizard", "model_catalog.json"));
      if (stats.isFile) {
        return rootDir;
      }
    } catch {
      // Ignore missing candidates.
    }
  }

  throw new Error("Unable to locate GeoRefineInternal. Set GEOREFINE_ROOT to the repo path.");
}

export async function loadLocalEnv(path: string) {
  const values: Record<string, string> = {};
  try {
    const text = await Deno.readTextFile(path);
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
      const separator = normalized.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = normalized.slice(0, separator).trim();
      let value = normalized.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  return values;
}

export async function detectHardware(localEnv: Record<string, string>, rootDir: string): Promise<HardwareSummary> {
  const cpuCores = Math.max(1, navigator.hardwareConcurrency || 1);
  const memoryInfo = Deno.systemMemoryInfo();
  const systemRamGb = Math.round(memoryInfo.total / 1024 / 1024 / 1024);
  let gpuPresent = false;
  let gpuName = "none";
  let gpuVramGb = 0;

  try {
    const result = await new Deno.Command("nvidia-smi", {
      args: ["--query-gpu=name,memory.total", "--format=csv,noheader"],
      stdout: "piped",
      stderr: "null",
    }).output();
    if (result.success) {
      const line = new TextDecoder().decode(result.stdout).trim().split("\n")[0]?.trim() ?? "";
      if (line) {
        const [namePart, memoryPart] = line.split(",", 2);
        gpuPresent = true;
        gpuName = (namePart ?? "unknown").trim();
        const vramMb = Number.parseFloat((memoryPart ?? "0").trim().split(/\s+/)[0] ?? "0");
        gpuVramGb = Math.round(vramMb / 1024);
      }
    }
  } catch {
    // No GPU is fine.
  }

  const dockerComposeAvailable = await commandSucceeds("docker", ["compose", "version"], rootDir);

  return {
    cpuCores,
    systemRamGb,
    gpuPresent,
    gpuName,
    gpuVramGb,
    deviceDefault: gpuPresent ? "cuda" : "cpu",
    hfAuthLoaded: HF_TOKEN_KEYS.some((key) => Boolean(localEnv[key] || Deno.env.get(key))),
    dockerComposeAvailable,
  };
}

export async function loadModelCatalog(path: string) {
  const text = await Deno.readTextFile(path);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`Model catalog at ${path} is not an array.`);
  }
  return parsed as ModelCatalogEntry[];
}

export async function discoverModelCandidates(
  rootDir: string,
  catalog: ModelCatalogEntry[],
  hardware: HardwareSummary,
) {
  const candidates: ModelCandidate[] = [];
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const cachedIds = new Set<string>();
  const hfCacheDir = join(Deno.env.get("HOME") ?? "", ".cache", "huggingface", "hub");

  try {
    for await (const entry of Deno.readDir(hfCacheDir)) {
      if (!entry.isDirectory || !entry.name.startsWith("models--")) {
        continue;
      }
      const modelId = entry.name.slice("models--".length).replaceAll("--", "/");
      cachedIds.add(modelId);
      const known = catalogById.get(modelId);
      candidates.push({
        section: "local",
        source: "hf-cache",
        fit: fitLabel(
          known?.min_vram_gb ?? 0,
          known?.recommended_device ?? (hardware.gpuPresent ? "cuda" : "cpu"),
          hardware,
        ),
        display: `${modelId} [cached]`,
        ref: modelId,
        containerRef: modelId,
        localOnly: true,
        remoteCode: Boolean(known?.requires_remote_code),
        gated: Boolean(known?.gated),
        paramsB: known?.params_b ?? null,
        minVramGb: known?.min_vram_gb ?? null,
        notes: [
          known?.notes ?? "",
          `Resolved from local HF cache at ${join(hfCacheDir, entry.name)}`,
        ].filter(Boolean).join(" "),
        modelId,
        family: known?.family ?? "cached",
      });
    }
  } catch {
    // Missing cache is fine.
  }

  for (const localRoot of [join(rootDir, "models"), join(rootDir, "compressed")]) {
    try {
      for await (const entry of Deno.readDir(localRoot)) {
        if (!entry.isDirectory) {
          continue;
        }
        const modelPath = join(localRoot, entry.name);
        const configPath = join(modelPath, "config.json");
        let config: Record<string, unknown> = {};
        try {
          const stats = await Deno.stat(configPath);
          if (!stats.isFile) {
            continue;
          }
          config = JSON.parse(await Deno.readTextFile(configPath));
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) {
            continue;
          }
        }

        const displayBase = stringValue(config._name_or_path) || entry.name;
        const architectures = Array.isArray(config.architectures)
          ? config.architectures.filter((value): value is string => typeof value === "string")
          : [];
        const relPath = relative(rootDir, modelPath).replaceAll("\\", "/");
        const notes = [`Local directory at ${relPath}`];
        if (architectures.length > 0) {
          notes.push(`arch=${architectures.slice(0, 2).join(",")}`);
        }

        candidates.push({
          section: "local",
          source: "local-dir",
          fit: fitLabel(0, hardware.gpuPresent ? "cuda" : "cpu", hardware),
          display: `${displayBase} [local-dir]`,
          ref: modelPath,
          containerRef: `/app/${relPath}`,
          localOnly: false,
          remoteCode: false,
          gated: false,
          paramsB: null,
          minVramGb: 0,
          notes: notes.join("; "),
          modelId: entry.name,
          family: "local",
        });
      }
    } catch {
      // Missing local model folders are fine.
    }
  }

  for (const entry of catalog) {
    const cachedNote = cachedIds.has(entry.id) ? "Cached locally." : "";
    candidates.push({
      section: "huggingface",
      source: "huggingface",
      fit: fitLabel(entry.min_vram_gb ?? 0, entry.recommended_device ?? "cuda", hardware),
      display: entry.id,
      ref: entry.id,
      containerRef: entry.id,
      localOnly: false,
      remoteCode: Boolean(entry.requires_remote_code),
      gated: Boolean(entry.gated),
      paramsB: entry.params_b ?? null,
      minVramGb: entry.min_vram_gb ?? null,
      notes: [entry.notes ?? "", cachedNote].filter(Boolean).join(" "),
      modelId: entry.id,
      family: entry.family ?? "catalog",
    });
  }

  return candidates;
}

export function fitLabel(minVramGb: number, recommendedDevice: string, hardware: HardwareSummary): ModelFit {
  if (recommendedDevice === "cpu") {
    return "good";
  }
  if (!hardware.gpuPresent) {
    return "cpu-only";
  }
  if (hardware.gpuVramGb >= minVramGb) {
    return "good";
  }
  if (hardware.gpuVramGb + 4 >= minVramGb) {
    return "stretch";
  }
  return "unlikely";
}

export function applyCalibrationProfile(goal: GoalPreset, profileId: CalibrationProfileId): AppliedCalibration {
  const profile = CALIBRATION_PROFILES.find((entry) => entry.id === profileId) ?? CALIBRATION_PROFILES[0]!;
  switch (profileId) {
    case "heavy":
      return {
        ...profile,
        effectiveCalTokens: Math.max(goal.calTokens * 2, 8192),
        effectiveProxyTokens: Math.max(goal.proxyTokens * 2, 2048),
      };
    default:
      return {
        ...profile,
        effectiveCalTokens: goal.calTokens,
        effectiveProxyTokens: goal.proxyTokens,
      };
  }
}

export function sanitizeName(value: string) {
  return value
    .replaceAll("/", "_")
    .replaceAll(" ", "_")
    .replaceAll(":", "_")
    .replaceAll(/[^A-Za-z0-9._-]/g, "_");
}

export function createRunTag(date: Date, containerRef: string, goalName: string) {
  return `${formatRunTimestamp(date)}_${sanitizeName(containerRef)}_${sanitizeName(goalName)}`;
}

export function createLaunchPlan(
  context: GeoRefineContext,
  selectedModel: ModelCandidate,
  goal: GoalPreset,
  calibrationProfileId: CalibrationProfileId,
  date = new Date(),
): LaunchPlan {
  const calibration = applyCalibrationProfile(goal, calibrationProfileId);
  const runTag = createRunTag(date, selectedModel.containerRef, goal.name);
  const containerName = `grwizard-${sanitizeName(runTag).toLowerCase()}`;
  const resultsRoot = join(context.rootDir, "results", "grwizard", runTag);
  const compressedRoot = join(context.rootDir, "compressed", "grwizard", runTag);
  const runRoot = join(context.runsDir, runTag);
  const swarmRuntimeRoot = join(runRoot, "runtime_root");
  const progressFileHost = join(resultsRoot, "progress.json");
  const resultFileHost = join(resultsRoot, "result.json");
  const autopilotLogHost = join(resultsRoot, "swarm_autopilot.log");
  const georefineLogHost = join(resultsRoot, "georefine.log.jsonl");
  const checkpointDirHost = join(resultsRoot, "checkpoint");
  const saveDirHost = compressedRoot;
  const agendaPathHost = join(runRoot, "agenda.json");
  const containerScriptHost = join(runRoot, "run_in_container.sh");
  const containerBase = `/app/grWizard/runs/${runTag}`;
  const progressFileContainer = `/app/results/grwizard/${runTag}/progress.json`;
  const resultFileContainer = `/app/results/grwizard/${runTag}/result.json`;
  const autopilotLogContainer = `/app/results/grwizard/${runTag}/swarm_autopilot.log`;
  const georefineLogContainer = `/app/results/grwizard/${runTag}/georefine.log.jsonl`;
  const checkpointDirContainer = `/app/results/grwizard/${runTag}/checkpoint`;
  const saveDirContainer = `/app/compressed/grwizard/${runTag}`;
  const agendaPathContainer = `${containerBase}/agenda.json`;
  const containerScriptContainer = `${containerBase}/run_in_container.sh`;
  const swarmRuntimeRootContainer = `${containerBase}/runtime_root`;
  const successCriterion = `quality degradation <= ${goal.threshold}`;

  const georefineCommandArgs = [
    "python3",
    "-u",
    "-m",
    "experiments.georefine",
    goal.autonomous ? "--autonomous" : "--agentic",
    "--model",
    selectedModel.containerRef,
    "--device",
    context.hardware.deviceDefault,
    "--dtype",
    "auto",
    "--pipeline-template",
    goal.template,
    "--quality-threshold",
    String(goal.threshold),
    "--cal-tokens",
    String(calibration.effectiveCalTokens),
    "--proxy-tokens",
    String(calibration.effectiveProxyTokens),
    "--local-search-sweeps",
    String(goal.sweeps),
    "--checkpoint-dir",
    checkpointDirContainer,
    "--save-dir",
    saveDirContainer,
    "--output",
    resultFileContainer,
    "--progress-file",
    progressFileContainer,
    "--log-file",
    georefineLogContainer,
    "--log-level",
    "info",
    "--monitor-interval",
    String(goal.monitorInterval),
    "--steering-port",
    "0",
  ];

  if (selectedModel.localOnly) {
    georefineCommandArgs.push("--local-only");
  }
  if (selectedModel.remoteCode) {
    georefineCommandArgs.push("--allow-remote-code");
  }
  if (goal.strict) {
    georefineCommandArgs.push("--strict-quality");
  }

  const georefineCommandString = shellJoin(georefineCommandArgs);
  const dockerArgs = buildDockerArgs(context, runTag);

  return {
    context,
    selectedModel,
    goal,
    calibration,
    runTag,
    containerName,
    resultsRoot,
    compressedRoot,
    runRoot,
    swarmRuntimeRoot,
    agendaPathHost,
    containerScriptHost,
    progressFileHost,
    resultFileHost,
    autopilotLogHost,
    georefineLogHost,
    checkpointDirHost,
    saveDirHost,
    agendaPathContainer,
    containerScriptContainer,
    progressFileContainer,
    resultFileContainer,
    autopilotLogContainer,
    georefineLogContainer,
    checkpointDirContainer,
    saveDirContainer,
    swarmRuntimeRootContainer,
    successCriterion,
    georefineCommandArgs,
    georefineCommandString,
    dockerArgs,
  };
}

export async function prepareLaunchArtifacts(plan: LaunchPlan) {
  await Deno.mkdir(plan.resultsRoot, { recursive: true });
  await Deno.mkdir(plan.compressedRoot, { recursive: true });
  await Deno.mkdir(plan.runRoot, { recursive: true });
  await resetSwarmRuntime(plan);
  await writeAgenda(plan);
  await writeContainerRunner(plan);
}

export async function ensureCompressImage(rootDir: string) {
  const inspect = await new Deno.Command("docker", {
    cwd: rootDir,
    args: ["image", "inspect", "georefine:compress"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (inspect.success) {
    return { built: false };
  }

  const build = await new Deno.Command("docker", {
    cwd: rootDir,
    args: ["compose", "build", "compress"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!build.success) {
    const stderr = new TextDecoder().decode(build.stderr);
    throw new Error(stderr || "Failed to build georefine:compress image.");
  }
  return { built: true, output: new TextDecoder().decode(build.stdout) };
}

export function spawnDockerRun(plan: LaunchPlan) {
  return new Deno.Command("docker", {
    cwd: plan.context.rootDir,
    args: plan.dockerArgs,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
}

export async function loadRunSnapshot(plan: LaunchPlan, outputTail = [] as string[]): Promise<RunSnapshot> {
  const [boardRaw, sharedStateRaw, autopilotRaw, progressRaw, resultRaw, checkpointRaw] = await Promise.all([
    readJsonIfExists(plan.swarmRuntimeRoot, "swarm", "board.json"),
    readJsonIfExists(plan.swarmRuntimeRoot, "swarm", "shared_state.json"),
    readJsonIfExists(plan.swarmRuntimeRoot, "swarm", "status", "autopilot.json"),
    readJsonIfExists(plan.progressFileHost),
    readJsonIfExists(plan.resultFileHost),
    readJsonIfExists(plan.checkpointDirHost, "pipeline_state.json"),
  ]);

  const georefineTail = await readGeorefineTail(plan.georefineLogHost, 120);
  const swarmTail = await tailFileLines(plan.autopilotLogHost, 120);
  const board = parseBoard(boardRaw);
  const progress = parseProgress(progressRaw);
  const result = parseResult(resultRaw);
  const checkpoint = isRecord(checkpointRaw) ? checkpointRaw : null;
  const sharedState = isRecord(sharedStateRaw) ? sharedStateRaw : {};
  const autopilotStatus = isRecord(autopilotRaw) ? autopilotRaw : null;

  const currentTask = stringValue(sharedState["autopilot.current_experiment"]) ||
    stringValue(sharedState["autopilot.current"]) ||
    board.active[0]?.note ||
    board.active[0]?.id ||
    progress?.currentPhase ||
    stringValue(checkpoint?.current_phase) ||
    "No active run";

  const currentPhase = progress?.currentPhase || stringValue(checkpoint?.current_phase) || "preflight";
  const progressRatio = deriveProgressRatio(progressRaw, checkpoint);
  const [modelLoadRatio, dataLoadRatio] = deriveLoadRatios(georefineTail, progress, checkpoint);
  const swarmState = stringValue(sharedState["autopilot.status"]) ||
    stringValue(autopilotStatus?.status) ||
    (result ? "complete" : "idle");
  const swarmCurrent = stringValue(sharedState["autopilot.current_experiment"]) ||
    stringValue(sharedState["autopilot.current"]) ||
    plan.runTag;
  const swarmStep = stringValue(sharedState["autopilot.current_step"]) || "-";
  const activeAgents = collectActiveAgents(autopilotStatus);
  const alerts = [
    ...collectGeorefineAlerts(georefineTail),
    ...collectResultAlerts(result),
  ].slice(0, 8);
  const resultSummary = buildResultSummary(result, plan.resultFileHost);

  return {
    board,
    sharedState,
    autopilotStatus,
    progress,
    result,
    checkpoint,
    currentTask,
    currentPhase,
    progressRatio,
    progressLabel: progress?.status || stringValue(result?.runStatus) || "idle",
    modelLoadRatio,
    dataLoadRatio,
    swarmState,
    swarmCurrent,
    swarmStep,
    activeAgents,
    alerts,
    outputTail: tail(outputTail, 240),
    georefineTail,
    swarmTail,
    resultSummary,
  };
}

export function categorizeTaskStatus(status: string): RunTask["column"] {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("running") ||
    normalized.includes("progress") ||
    normalized.includes("claimed") ||
    normalized.includes("active")
  ) {
    return "active";
  }
  if (
    normalized.includes("done") ||
    normalized.includes("completed") ||
    normalized.includes("success") ||
    normalized.includes("merged")
  ) {
    return "done";
  }
  if (
    normalized.includes("review") ||
    normalized.includes("blocked") ||
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("cancel")
  ) {
    return "review";
  }
  return "backlog";
}

function buildDockerArgs(context: GeoRefineContext, runTag: string) {
  const args = [
    "compose",
    "run",
    "--rm",
    "--name",
    `grwizard-${sanitizeName(runTag).toLowerCase()}`,
    "-v",
    `${context.rootDir}:/app`,
    "--entrypoint",
    "/bin/bash",
  ];

  for (const key of HF_TOKEN_KEYS) {
    const value = context.localEnv[key] || Deno.env.get(key);
    if (value) {
      args.push("-e", `${key}=${value}`);
    }
  }

  args.push("compress", "-lc", `cd /app && bash grWizard/runs/${runTag}/run_in_container.sh`);
  return args;
}

async function resetSwarmRuntime(plan: LaunchPlan) {
  await Deno.remove(plan.swarmRuntimeRoot, { recursive: true }).catch(() => undefined);
  await Deno.mkdir(plan.swarmRuntimeRoot, { recursive: true });

  const source = join(plan.context.rootDir, "swarm");
  const copy = await new Deno.Command("cp", {
    args: ["-a", source, `${plan.swarmRuntimeRoot}/`],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!copy.success) {
    const stderr = new TextDecoder().decode(copy.stderr);
    throw new Error(stderr || `Failed to copy swarm runtime from ${source}`);
  }

  const swarmRoot = join(plan.swarmRuntimeRoot, "swarm");
  for (const dir of SWARM_RESET_DIRS) {
    await Deno.remove(join(swarmRoot, dir), { recursive: true }).catch(() => undefined);
    await Deno.mkdir(join(swarmRoot, dir), { recursive: true });
  }

  for (const file of SWARM_RESET_FILES) {
    await Deno.remove(join(swarmRoot, file)).catch(() => undefined);
  }

  await Deno.writeTextFile(join(swarmRoot, "shared_state.json"), "{}\n");
  await Deno.writeTextFile(join(swarmRoot, "gpu_lock.json"), "{}\n");
  await Deno.writeTextFile(join(swarmRoot, "file_locks.json"), "{}\n");
  await Deno.writeTextFile(join(swarmRoot, "board.json"), '{"tasks":{}}\n');
  await Deno.writeTextFile(join(swarmRoot, "events.jsonl"), "");
}

async function writeAgenda(plan: LaunchPlan) {
  const modelKey = sanitizeName(plan.selectedModel.display);
  const agenda = {
    models: {
      [modelKey]: {
        unpruned_ppl: null,
        current_best_ppl: null,
        current_best_degradation: null,
        current_best_path: null,
      },
    },
    hypotheses: [
      {
        id: `grwizard_${sanitizeName(plan.runTag)}`,
        description: `grWizard agentic compression for ${plan.selectedModel.display} (${plan.goal.label})`,
        priority: 1,
        status: "untested",
        type: "experiment",
        agent_type: "cli",
        estimated_hours: 8,
        commands: [plan.georefineCommandString],
        success_criterion: plan.successCriterion,
      },
    ],
  };

  await Deno.writeTextFile(plan.agendaPathHost, JSON.stringify(agenda, null, 2));
}

async function writeContainerRunner(plan: LaunchPlan) {
  const script = `#!/usr/bin/env bash
set -euo pipefail

AGENDA_PATH="${plan.agendaPathContainer}"
PROGRESS_FILE="${plan.progressFileContainer}"
RESULT_FILE="${plan.resultFileContainer}"
AUTOPILOT_LOG="${plan.autopilotLogContainer}"
SWARM_RUNTIME_ROOT="${plan.swarmRuntimeRootContainer}"
GEOREFINE_LOG_FILE="${plan.georefineLogContainer}"

export PYTHONPATH="\${SWARM_RUNTIME_ROOT}:/app\${PYTHONPATH:+:\${PYTHONPATH}}"
cd "\${SWARM_RUNTIME_ROOT}"

echo "[grWizard] starting swarm autopilot inside compress container"
python3 -u -m swarm.autopilot --agenda "\${AGENDA_PATH}" --once >"\${AUTOPILOT_LOG}" 2>&1 &
AUTOPILOT_PID=\$!
echo "[grWizard] autopilot pid=\${AUTOPILOT_PID}"

LAST_SUMMARY=""
LAST_LOG_LINE=0
LAST_GEO_LOG_LINE=0

emit_summary() {
  python3 - "\${PROGRESS_FILE}" <<'PY'
import json
import sys
from pathlib import Path

from swarm.coordinator import get_swarm_status_snapshot, shared_mind

progress_path = Path(sys.argv[1])
snap = get_swarm_status_snapshot()
details = (snap.get("tasks") or {}).get("details") or {}
available = details.get("available", (snap.get("tasks") or {}).get("available", 0))
claimed = details.get("claimed", (snap.get("tasks") or {}).get("claimed", 0))
completed = details.get("completed", (snap.get("tasks") or {}).get("completed", 0))
failed = details.get("failed", (snap.get("tasks") or {}).get("failed", 0))
alive_agents = [
    aid for aid, info in sorted((snap.get("agents") or {}).items())
    if isinstance(info, dict) and info.get("alive")
]
agent_preview = ",".join(alive_agents[:4]) if alive_agents else "-"
swarm_state = shared_mind.get("autopilot.status") or "unknown"
swarm_current = shared_mind.get("autopilot.current_experiment") or shared_mind.get("autopilot.current") or "-"
swarm_step = shared_mind.get("autopilot.current_step") or "-"

lines = [
    f"[swarm] state={swarm_state} current={swarm_current} step={swarm_step} agents={agent_preview} tasks=avail:{available} claimed:{claimed} done:{completed} failed:{failed}"
]

if progress_path.exists():
    try:
        with open(progress_path) as f:
            progress = json.load(f)
        phases = progress.get("phases") or []
        completed_phases = [p.get("name") for p in phases if p.get("status") == "completed"]
        failed_phases = [p.get("name") for p in phases if p.get("status") == "failed"]
        skipped_phases = [p.get("name") for p in phases if p.get("status") == "skipped"]
        running_phases = [p.get("name") for p in phases if p.get("status") == "running"]
        tail_completed = ",".join(completed_phases[-3:]) if completed_phases else "-"
        current_phase = progress.get("current_phase") or "-"
        status = progress.get("status") or "unknown"
        pct = float(progress.get("overall_progress_pct") or 0.0)
        elapsed_s = float(progress.get("elapsed_s") or 0.0)
        phase_total = len(phases)
        completed_count = len(completed_phases)
        running_label = ",".join(running_phases[:2]) if running_phases else current_phase
        lines.append(
            f"[georefine] status={status} phase={running_label} progress={pct:.0f}% elapsed={elapsed_s/60.0:.1f}m phases={completed_count}/{phase_total} recent={tail_completed}"
        )
        if failed_phases:
            lines.append(f"[georefine] failed_phases={','.join(failed_phases[:4])}")
        if skipped_phases:
            lines.append(f"[georefine] skipped={','.join(skipped_phases[:4])}")
        if current_phase and current_phase != "-":
            lines.append(f"[georefine] current_phase={current_phase}")
    except Exception as exc:
        lines.append(f"[georefine] progress_parse_error={type(exc).__name__}:{exc}")
else:
    lines.append("[georefine] waiting_for_progress_file")

print("\\n".join(lines))
PY
}

emit_new_log_lines() {
  if [[ ! -f "\${AUTOPILOT_LOG}" ]]; then
    return
  fi
  local current_lines
  current_lines=\$(wc -l < "\${AUTOPILOT_LOG}")
  if (( current_lines <= LAST_LOG_LINE )); then
    return
  fi
  local new_text
  new_text=\$(sed -n "\$((LAST_LOG_LINE + 1)),\${current_lines}p" "\${AUTOPILOT_LOG}" | grep -E '(^\\[[0-9]{2}:|FAILED|TIMEOUT|Recovered|Step |Completed in|soft-success|Shutting down|Running |Traceback|PermissionError|[Ee]rror:|Exception)' || true)
  LAST_LOG_LINE=\${current_lines}
  if [[ -n "\${new_text}" ]]; then
    while IFS= read -r line; do
      [[ -n "\${line}" ]] && echo "[swarm-log] \${line}"
    done <<< "\${new_text}"
  fi
}

emit_new_georefine_log_lines() {
  if [[ ! -f "\${GEOREFINE_LOG_FILE}" ]]; then
    return
  fi
  local current_lines
  current_lines=\$(wc -l < "\${GEOREFINE_LOG_FILE}")
  if (( current_lines <= LAST_GEO_LOG_LINE )); then
    return
  fi
  local new_text
  new_text=\$(sed -n "\$((LAST_GEO_LOG_LINE + 1)),\${current_lines}p" "\${GEOREFINE_LOG_FILE}" | grep -E '(Starting phase:|Completed phase:|Phase failed:|Resuming from checkpoint|checkpoint|Loaded calibration|Loading model|quality gate|quality threshold|Evaluating|compression complete)' || true)
  LAST_GEO_LOG_LINE=\${current_lines}
  if [[ -n "\${new_text}" ]]; then
    while IFS= read -r line; do
      [[ -n "\${line}" ]] && echo "[georefine-log] \${line}"
    done <<< "\${new_text}"
  fi
}

while kill -0 "\${AUTOPILOT_PID}" 2>/dev/null; do
  CURRENT_SUMMARY="\$(emit_summary || true)"
  if [[ -n "\${CURRENT_SUMMARY}" && "\${CURRENT_SUMMARY}" != "\${LAST_SUMMARY}" ]]; then
    echo "\${CURRENT_SUMMARY}"
    LAST_SUMMARY="\${CURRENT_SUMMARY}"
  fi
  emit_new_log_lines
  emit_new_georefine_log_lines
  sleep 5
done

RC=0
if wait "\${AUTOPILOT_PID}"; then
  RC=0
else
  RC=\$?
fi

FINAL_SUMMARY="\$(emit_summary || true)"
if [[ -n "\${FINAL_SUMMARY}" && "\${FINAL_SUMMARY}" != "\${LAST_SUMMARY}" ]]; then
  echo "\${FINAL_SUMMARY}"
fi
emit_new_log_lines
emit_new_georefine_log_lines

if (( RC != 0 )) && [[ -f "\${AUTOPILOT_LOG}" ]]; then
  echo "[swarm-log] tail of autopilot log:"
  tail -n 40 "\${AUTOPILOT_LOG}" | sed 's/^/[swarm-log] /'
fi

python3 - "\${RESULT_FILE}" <<'PY'
import json
import sys
from pathlib import Path

result_path = Path(sys.argv[1])
if not result_path.exists():
    print(f"[result] missing_manifest={result_path}")
    raise SystemExit(0)

with open(result_path) as f:
    payload = json.load(f)

run_status = payload.get("run_status") or payload.get("status") or "unknown"
artifact_kind = payload.get("artifact_kind") or "unknown"
save_dir = payload.get("save_dir") or payload.get("output_dir") or "-"
baseline_ppl = payload.get("baseline_ppl", payload.get("unpruned_ppl"))
final_ppl = payload.get("final_ppl")
degradation = payload.get("degradation")
quality_metric = payload.get("quality_metric")
final_quality = payload.get("final_quality")

print(f"[result] artifact={artifact_kind} run_status={run_status}")
if baseline_ppl is not None and final_ppl is not None:
    deg = f" degradation={degradation:.4f}" if isinstance(degradation, (float, int)) else ""
    print(f"[result] ppl baseline={baseline_ppl:.4f} final={final_ppl:.4f}{deg}")
elif quality_metric and final_quality is not None:
    print(f"[result] {quality_metric}={final_quality}")
print(f"[result] manifest={result_path}")
print(f"[result] save_dir={save_dir}")
PY

echo "[grWizard] autopilot exit_code=\${RC}"
exit "\${RC}"
`;

  await Deno.writeTextFile(plan.containerScriptHost, script);
  await Deno.chmod(plan.containerScriptHost, 0o755);
}

async function readJsonIfExists(...parts: string[]) {
  try {
    return JSON.parse(await Deno.readTextFile(join(...parts)));
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof SyntaxError
    ) {
      return null;
    }
    throw error;
  }
}

async function readGeorefineTail(path: string, limit: number) {
  const lines = await tailFileLines(path, limit);
  const messages: string[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const message = stringValue(parsed.message);
      if (message) {
        messages.push(message);
      }
    } catch {
      messages.push(line);
    }
  }
  return tail(messages, limit);
}

async function tailFileLines(path: string, limit: number) {
  try {
    const text = await Deno.readTextFile(path);
    return tail(
      text
        .split("\n")
        .map((line) => line.trimEnd())
        .filter(Boolean),
      limit,
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return [];
    }
    throw error;
  }
}

function parseBoard(raw: unknown): RunBoard {
  const board: RunBoard = {
    backlog: [],
    active: [],
    review: [],
    done: [],
  };

  const tasks = isRecord(raw) && isRecord(raw.tasks) ? raw.tasks : {};
  const entries = Object.entries(tasks)
    .map(([id, value]) => {
      const record = isRecord(value) ? value : {};
      const status = stringValue(record.status) || "unknown";
      return {
        id,
        status,
        type: stringValue(record.type) || "task",
        priority: numberValue(record.priority) ?? 99,
        note: stringValue(record.note) || "",
        column: categorizeTaskStatus(status),
      } satisfies RunTask;
    })
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

  for (const entry of entries) {
    board[entry.column].push(entry);
  }
  return board;
}

function parseProgress(raw: unknown): RunProgressSnapshot | null {
  if (!isRecord(raw)) {
    return null;
  }
  const phasesRaw = Array.isArray(raw.phases) ? raw.phases : [];
  return {
    status: stringValue(raw.status) || "unknown",
    currentPhase: stringValue(raw.current_phase) || "preflight",
    overallProgressPct: numberValue(raw.overall_progress_pct) ?? 0,
    elapsedSeconds: numberValue(raw.elapsed_s) ?? 0,
    phases: phasesRaw.map((phase) => {
      const record = isRecord(phase) ? phase : {};
      return {
        name: stringValue(record.name) || "phase",
        status: stringValue(record.status) || "unknown",
        startedAt: stringValue(record.started_at) || null,
        completedAt: stringValue(record.completed_at) || null,
        durationSeconds: numberValue(record.duration_s) ?? null,
        metrics: isRecord(record.metrics) ? record.metrics : {},
        error: stringValue(record.error) || null,
      } satisfies RunProgressPhase;
    }),
    checkpointPath: stringValue(raw.checkpoint_path) || null,
  };
}

function parseResult(raw: unknown): RunResultSnapshot | null {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    runStatus: stringValue(raw.run_status) || stringValue(raw.status) || "unknown",
    artifactKind: stringValue(raw.artifact_kind) || "unknown",
    saveDir: stringValue(raw.save_dir) || stringValue(raw.output_dir) || null,
    baselinePpl: numberValue(raw.baseline_ppl) ?? numberValue(raw.unpruned_ppl) ?? null,
    finalPpl: numberValue(raw.final_ppl) ?? null,
    degradation: numberValue(raw.degradation) ?? null,
    qualityMetric: stringValue(raw.quality_metric) || null,
    finalQuality: numberValue(raw.final_quality) ?? stringValue(raw.final_quality) ?? null,
  };
}

function deriveProgressRatio(rawProgress: unknown, checkpoint: Record<string, unknown> | null) {
  const progress = parseProgress(rawProgress);
  if (progress) {
    return clamp(progress.overallProgressPct / 100, 0, 1);
  }
  if (checkpoint) {
    const completed = Array.isArray(checkpoint.completed_phases)
      ? checkpoint.completed_phases.filter((value): value is string => typeof value === "string")
      : [];
    const currentPhase = stringValue(checkpoint.current_phase);
    const maxPhase = phaseOrder.length;
    const completedCount = completed.filter((phase) => phaseOrder.includes(phase)).length;
    const currentPhaseIndex = currentPhase ? phaseOrder.indexOf(currentPhase) : -1;
    const phaseRatio = currentPhaseIndex >= 0 ? (currentPhaseIndex + 0.35) / maxPhase : completedCount / maxPhase;
    return clamp(Math.max(completedCount / maxPhase, phaseRatio), 0, 0.92);
  }
  return 0;
}

function deriveLoadRatios(
  georefineTail: string[],
  progress: RunProgressSnapshot | null,
  checkpoint: Record<string, unknown> | null,
) {
  let model = 0;
  let data = 0;
  for (const line of georefineTail) {
    const lower = line.toLowerCase();
    if (lower.includes("loading model and data")) {
      model = Math.max(model, 0.08);
      data = Math.max(data, 0.04);
    }
    if (lower.includes("trying loading strategy")) {
      model = Math.max(model, 0.26);
    }
    if (lower.includes("loaded with strategy") || lower.includes("loading strategy:")) {
      model = Math.max(model, 0.78);
    }
    if (lower.includes("architecture:") || lower.includes("device:")) {
      model = Math.max(model, 0.92);
    }
    if (lower.includes("dataset:")) {
      data = Math.max(data, 0.72);
    }
    if (lower.includes("validation:") || lower.includes("baseline ppl")) {
      data = Math.max(data, 1);
      model = Math.max(model, 1);
    }
  }

  if (
    progress &&
    progress.phases.some((phase) => phase.name.toLowerCase().includes("load") && phase.status === "completed")
  ) {
    model = 1;
    data = 1;
  }
  if (checkpoint) {
    const completed = Array.isArray(checkpoint.completed_phases)
      ? checkpoint.completed_phases.filter((value): value is string => typeof value === "string")
      : [];
    if (completed.length > 0 || stringValue(checkpoint.current_phase)) {
      model = Math.max(model, 1);
      data = Math.max(data, 1);
    }
  }

  return [clamp(model, 0, 1), clamp(data, 0, 1)] as const;
}

function collectActiveAgents(autopilotStatus: Record<string, unknown> | null) {
  const status = stringValue(autopilotStatus?.status);
  if (!status) {
    return [];
  }
  return [status.toUpperCase()];
}

function collectGeorefineAlerts(lines: string[]) {
  return lines
    .filter((line) => /critical|failed|error|warning/i.test(line))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .slice(-6)
    .reverse();
}

function collectResultAlerts(result: RunResultSnapshot | null) {
  if (!result) {
    return [];
  }
  if (/failed|error/i.test(result.runStatus)) {
    return [`Run status: ${result.runStatus}`];
  }
  return [];
}

function buildResultSummary(result: RunResultSnapshot | null, resultPath: string) {
  if (!result) {
    return [`Result manifest pending: ${resultPath}`];
  }
  const lines = [
    `Status: ${result.runStatus}`,
    `Artifact: ${result.artifactKind}`,
  ];
  if (result.baselinePpl != null && result.finalPpl != null) {
    lines.push(`PPL ${result.baselinePpl.toFixed(4)} -> ${result.finalPpl.toFixed(4)}`);
  }
  if (result.degradation != null) {
    lines.push(`Degradation ${result.degradation.toFixed(4)}`);
  }
  if (result.qualityMetric && result.finalQuality != null) {
    lines.push(`${result.qualityMetric}: ${String(result.finalQuality)}`);
  }
  if (result.saveDir) {
    lines.push(`Save: ${result.saveDir}`);
  }
  return lines;
}

async function commandSucceeds(command: string, args: string[], cwd?: string) {
  try {
    const result = await new Deno.Command(command, {
      args,
      cwd,
      stdout: "null",
      stderr: "null",
    }).output();
    return result.success;
  } catch {
    return false;
  }
}

function formatRunTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function shellJoin(args: string[]) {
  return args.map(shellQuote).join(" ");
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tail<T>(items: T[], limit: number) {
  return limit <= 0 ? [] : items.slice(-limit);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}
