#!/usr/bin/env python3
"""Repo-local helper for Infinite Context Coder operations."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def repo_root() -> Path:
    path = Path(__file__).resolve()
    for parent in path.parents:
        if (parent / ".icc" / "swarm-projects.json").is_file():
            return parent
    raise SystemExit("Could not find repo root containing .icc/swarm-projects.json")


def load_project(root: Path) -> dict:
    payload = json.loads((root / ".icc" / "swarm-projects.json").read_text(encoding="utf-8"))
    projects = payload.get("projects", [])
    if not projects:
        raise SystemExit(".icc/swarm-projects.json has no projects")
    return projects[0]


def icc_tool(root: Path, project: dict) -> Path:
    candidates = []
    env_home = os.environ.get("ICC_HOME")
    if env_home:
        candidates.append(Path(env_home).expanduser())
    candidates.extend([
        Path.home() / "projects" / "infinite_context_coder",
        root.parent / "infinite_context_coder",
    ])
    for home in candidates:
        tool = home / "scripts" / "codebase_tool.py"
        if tool.is_file():
            return tool
    metadata = project.get("metadata", {})
    hint = metadata.get("icc_command", "python3 <icc>/scripts/codebase_tool.py")
    raise SystemExit(f"Could not find ICC codebase_tool.py. Set ICC_HOME. Config hint: {hint}")


def python_for_tool(tool: Path) -> Path:
    venv_python = tool.parent.parent / ".venv" / "bin" / "python"
    return venv_python if venv_python.is_file() else Path(sys.executable)


def run(tool: Path, args: list[str], cwd: Path) -> int:
    process = subprocess.run([str(python_for_tool(tool)), str(tool), *args], cwd=str(cwd), text=True)
    return process.returncode


def run_checked(tool: Path, args: list[str], cwd: Path) -> None:
    code = run(tool, args, cwd)
    if code != 0:
        raise SystemExit(code)


def register_args(project: dict, root: Path) -> list[str]:
    args = ["register", "--name", project["icc_repo"], "--path", str(root)]
    for skip_dir in project.get("icc_skip_dirs", []):
        args.extend(["--skip-dir", skip_dir])
    return args


def raw_args(project: dict, args: list[str]) -> list[str]:
    repo_commands = {
        "resolve",
        "index",
        "build-memory",
        "build-git-history",
        "status",
        "architecture-summary",
        "pack-context",
        "file-history",
        "module-info",
        "trace-deps",
        "find-symbol",
        "find-file",
        "file-chunks",
        "get-chunk",
        "search-chunks",
        "read-lines",
        "guard-diff",
        "function-map",
        "include-graph",
        "impact-analysis",
        "extraction-plan",
        "trace-callers",
        "trace-callees",
        "pack-symbols",
        "find-clusters",
        "find-dead-code",
        "architecture-cheatsheet",
        "architecture-diff",
        "index-quality",
        "capture-baseline",
        "verify-baseline",
    }
    if args and args[0] in repo_commands and "--repo" not in args:
        return [args[0], "--repo", project["icc_repo"], *args[1:]]
    return args


def main() -> int:
    root = repo_root()
    project = load_project(root)
    tool = icc_tool(root, project)
    repo = project["icc_repo"]

    parser = argparse.ArgumentParser(description="Deno TUI ICC helper")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("tool", help="Print the resolved ICC tool path")
    subparsers.add_parser("register", help="Register this repo in ICC")
    refresh = subparsers.add_parser("refresh", help="Register, index, and build memory artifacts")
    refresh.add_argument("--git-history", action="store_true", help="Also build git history memory")
    status = subparsers.add_parser("status", help="Show artifact status")
    status.add_argument("--no-staleness", action="store_true", help="Skip git HEAD staleness check")
    summary = subparsers.add_parser("summary", help="Print bundled architecture summary")
    summary.add_argument("--include-cheatsheet", action="store_true")
    pack = subparsers.add_parser("pack", help="Build a task-focused context pack")
    pack.add_argument("task")
    raw = subparsers.add_parser("raw", help="Pass through to codebase_tool.py")
    raw.add_argument("args", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    if args.command == "tool":
        print(tool)
        return 0
    if args.command == "register":
        return run(tool, register_args(project, root), root)
    if args.command == "refresh":
        run_checked(tool, register_args(project, root), root)
        run_checked(tool, ["index", "--repo", repo], root)
        run_checked(tool, ["build-memory", "--repo", repo], root)
        if args.git_history:
            run_checked(tool, ["build-git-history", "--repo", repo], root)
        return 0
    if args.command == "status":
        command = ["status", "--repo", repo]
        if not args.no_staleness:
            command.append("--check-staleness")
        return run(tool, command, root)
    if args.command == "summary":
        command = ["architecture-summary", "--repo", repo, "--bundle"]
        if args.include_cheatsheet:
            command.append("--include-cheatsheet")
        return run(tool, command, root)
    if args.command == "pack":
        return run(tool, ["pack-context", "--repo", repo, "--task", args.task], root)
    if args.command == "raw":
        if not args.args:
            raise SystemExit("raw requires codebase_tool.py arguments")
        return run(tool, raw_args(project, args.args), root)
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
