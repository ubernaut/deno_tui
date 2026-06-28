---
name: deno-tui-icc
description: "Use this skill when working in this Deno TUI fork and the task needs Infinite Context Coder codebase memory: broad architecture surveys, impact analysis, symbol/file lookup, context packs, stale index refreshes, or readiness checks from the repo-local .icc configuration."
---

# Deno TUI ICC

## Purpose

This repo has a project-local `.icc/` configuration for Infinite Context Coder (ICC). Use it to build and query codebase
memory before broad, cross-cutting, or architecture-sensitive work.

## Quick Commands

Run from the repository root:

```bash
python3 .codex/skills/deno-tui-icc/scripts/icc.py status
python3 .codex/skills/deno-tui-icc/scripts/icc.py refresh
python3 .codex/skills/deno-tui-icc/scripts/icc.py summary
python3 .codex/skills/deno-tui-icc/scripts/icc.py pack "task description"
```

The helper reads `.icc/swarm-projects.json`, registers this repo as `deno_tui`, applies the configured skip dirs, and
calls `~/projects/infinite_context_coder/scripts/codebase_tool.py`.

## Workflow

1. Read `.icc/swarm-projects.json` for repo name, skip dirs, lanes, and verification commands.
2. Run `python3 .codex/skills/deno-tui-icc/scripts/icc.py status`.
3. If the repo is unregistered, artifacts are missing, or status reports stale artifacts, run
   `python3 .codex/skills/deno-tui-icc/scripts/icc.py refresh`.
4. For broad repo orientation, run `summary`.
5. For a concrete task, run `pack "<task>"` and use the returned task-focused file/chunk context to choose files.
6. For exact lookups, use `raw`:

```bash
python3 .codex/skills/deno-tui-icc/scripts/icc.py raw find-symbol --symbol ComboBoxController --limit 10
python3 .codex/skills/deno-tui-icc/scripts/icc.py raw function-map --path src/components/combobox.ts --format markdown
python3 .codex/skills/deno-tui-icc/scripts/icc.py raw impact-analysis --since main --format markdown
```

The helper injects `--repo deno_tui` for raw commands that need a repo when it is omitted.

## Readiness Files

- `.icc/completion-oracles.yaml`: project-specific readiness targets for library API, web runtime, visualizations, and
  no-regression smoke work.
- `.icc/production-audit.yaml`: audit profiles and severity policy for the same targets.
- `.icc/swarm-projects.json`: repo registration, skip dirs, lanes, and verification commands.

Current ICC source exposes the stable codebase-memory CLI (`register`, `index`, `build-memory`, `status`,
`architecture-summary`, `pack-context`, `function-map`, `impact-analysis`, etc.). Treat oracle/audit YAML as project
policy metadata unless the local ICC checkout later adds first-class oracle commands.

The current ICC checkout does not extract TypeScript function records, so `pack` intentionally uses `pack-context`. Use
`raw pack-symbols` only if the index reports nonzero `function_chunks_total`.

## Verification

After changing `.icc` or this skill, run:

```bash
python3 /home/cos/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/deno-tui-icc
python3 .codex/skills/deno-tui-icc/scripts/icc.py status
```
