#!/bin/bash
set -eo pipefail

PROMPT_FILE=""
TASKS_FILE=""
PROGRESS_FILE=""
ITERATIONS=""

while getopts ":p:f:r:n:" opt; do
  case $opt in
    p) PROMPT_FILE="$OPTARG" ;;
    f) TASKS_FILE="$OPTARG" ;;
    r) PROGRESS_FILE="$OPTARG" ;;
    n) ITERATIONS="$OPTARG" ;;
    *) echo "Usage: $0 -p prompt -f tasks -r progress -n iterations" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROMPT_FILE" || -z "$TASKS_FILE" || -z "$PROGRESS_FILE" || -z "$ITERATIONS" ]]; then
  echo "Usage: $0 -p prompt -f tasks -r progress -n iterations" >&2
  exit 1
fi

read -r -d '' RALPH_INSTRUCTIONS <<'EOF' || true
You are in a Ralph loop — a fresh session runs for each iteration with no memory of previous runs.
State lives in the task file and progress file shown above.

Each iteration:
1. Read the task file — find the first entry with "passes": false.
2. Read the progress file — the last entry tells you what was done previously.
3. Health check: run build and tests. If anything previously passing now fails, fix it first.
4. Pick the first task with "passes": false. Work on exactly one task per iteration.
5. Implement only what is needed to make that task pass.
6. Verify it passes (build / test / typecheck as appropriate). Fix failures before proceeding.
7. Set "passes": true for that task in the task file.
8. Append to the progress file: iteration number, task completed, one-line summary, build/test health.
9. Commit with a conventional commit message.
10. If all tasks have "passes": true and the build is clean, output <promise>COMPLETE</promise> and stop.

Rules:
- One task per iteration. Do not skip ahead.
- Never remove or reorder entries in the task file. Only flip "passes" from false to true.
- No --no-verify, no git push, no --force.
- If something genuinely blocks progress, output a short explanation of what is blocked and stop.
EOF

for ((i=1; i<=ITERATIONS; i++)); do
  echo "=== Iteration $i/$ITERATIONS ==="
  result=$(claude --dangerously-skip-permissions -p "$RALPH_INSTRUCTIONS @$TASKS_FILE @$PROGRESS_FILE $(cat "$PROMPT_FILE")") || {
    echo "claude exited with code $? on iteration $i" >&2
    exit 1
  }
  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Complete after $i iterations."
    exit 0
  fi
done
