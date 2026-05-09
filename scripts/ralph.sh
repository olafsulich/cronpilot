#!/usr/bin/env bash
# Ralph loop — runs a single PROMPT file against `claude` repeatedly until
# the spec is satisfied or MAX_ITER is reached.
#
# Each iteration is a fresh Claude Code session. No memory carries over.
# All state lives in the filesystem (the package being built + git history).
#
# Usage:
#   ./scripts/ralph.sh
#   PROMPT_FILE=docs/prompts/ralph-sdk-prompt.md ./scripts/ralph.sh
#   WORKDIR=packages/sdk MAX_ITER=20 ./scripts/ralph.sh
#
# Stop conditions:
#   - $WORKDIR/.ralph-done exists (the agent writes this when the spec is satisfied)
#   - $WORKDIR/RALPH-BLOCKED.md exists (the agent reports it can't progress)
#   - Iteration count reaches MAX_ITER
#   - Ctrl-C
#
# WARNING: this script invokes `claude` with --dangerously-skip-permissions
# so the loop runs unattended. Only run it on a feature branch in a worktree
# you don't mind being mutated. Never run against `main`.

set -euo pipefail

PROMPT_FILE="${PROMPT_FILE:-docs/prompts/ralph-sdk-prompt.md}"
WORKDIR="${WORKDIR:-packages/sdk}"
MAX_ITER="${MAX_ITER:-30}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-2}"
LOG_DIR="${LOG_DIR:-logs/ralph}"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "✗ Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
  echo "✗ Refusing to run Ralph on '$current_branch'. Switch to a feature branch first." >&2
  exit 1
fi

mkdir -p "$WORKDIR" "$LOG_DIR"

start_commit="$(git rev-parse HEAD 2>/dev/null || echo "no-commit")"

iter=0
while [ "$iter" -lt "$MAX_ITER" ]; do
  iter=$((iter + 1))
  log="$LOG_DIR/iter-$(printf '%03d' "$iter").log"

  printf '\n═══ Ralph iteration %d / %d ═══\n' "$iter" "$MAX_ITER"
  printf '  prompt:  %s\n' "$PROMPT_FILE"
  printf '  workdir: %s\n' "$WORKDIR"
  printf '  log:     %s\n' "$log"

  if [ -f "$WORKDIR/.ralph-done" ]; then
    printf '\n✓ Found %s/.ralph-done — Ralph reports the spec is satisfied.\n' "$WORKDIR"
    break
  fi

  if [ -f "$WORKDIR/RALPH-BLOCKED.md" ]; then
    printf '\n⚠ Found %s/RALPH-BLOCKED.md — Ralph reports it cannot progress.\n' "$WORKDIR"
    printf '  Inspect the file and resolve the block before re-running.\n'
    break
  fi

  if ! cat "$PROMPT_FILE" | claude --dangerously-skip-permissions 2>&1 | tee "$log"; then
    printf '⚠ Iteration %d exited non-zero. Continuing — Ralph absorbs failures.\n' "$iter"
  fi

  sleep "$SLEEP_BETWEEN"
done

end_commit="$(git rev-parse HEAD 2>/dev/null || echo "no-commit")"
commits_made="$(git rev-list --count "$start_commit..$end_commit" 2>/dev/null || echo "?")"

printf '\n──────────────────────────────────────────────\n'
if [ -f "$WORKDIR/.ralph-done" ]; then
  printf 'Result: ✓ done after %d iteration(s), %s commit(s).\n' "$iter" "$commits_made"
elif [ -f "$WORKDIR/RALPH-BLOCKED.md" ]; then
  printf 'Result: ⚠ blocked after %d iteration(s), %s commit(s).\n' "$iter" "$commits_made"
elif [ "$iter" -ge "$MAX_ITER" ]; then
  printf 'Result: ⏱ MAX_ITER reached. %d iteration(s), %s commit(s). Inspect %s.\n' \
    "$iter" "$commits_made" "$LOG_DIR"
else
  printf 'Result: stopped after %d iteration(s), %s commit(s).\n' "$iter" "$commits_made"
fi
