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
You are in a Ralph loop. Each run of this script is one iteration. You have no memory of previous iterations.

State lives entirely in the task file and progress file passed to you.

THIS ITERATION — do exactly these steps, in order, then stop:

1. Read the task file. Find the FIRST entry with "passes": false.
2. If ALL entries have "passes": true, output <promise>COMPLETE</promise> and stop immediately.
3. Read the progress file to understand what was done before.
4. Health check: if a build or test command exists, run it. If something previously passing now fails, fix it before proceeding.
5. Implement ONLY what is needed to make the ONE task you identified in step 1 pass. Do not touch any other task.
6. Verify it passes (build / test / typecheck as appropriate). Fix failures before moving on.
7. Set "passes": true for ONLY that one task in the task file.
8. Append one entry to the progress file: iteration number, task id, one-line summary, build/test health.
9. Make ONE git commit with a conventional commit message covering only this task.
10. STOP. Do not implement the next task. The loop will call you again for the next iteration.

Hard rules:
- ONE task per iteration. Never implement two tasks in one run, even if they seem related.
- After your commit, output nothing further and exit. The loop handles re-invocation.
- Never remove or reorder entries in the task file. Only flip "passes" from false to true.
- No --no-verify, no git push, no --force.
- If something genuinely blocks progress, write a short explanation to the progress file and stop.
EOF

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

for ((i=1; i<=ITERATIONS; i++)); do
  echo "=== Iteration $i/$ITERATIONS ==="
  claude --dangerously-skip-permissions -p "$RALPH_INSTRUCTIONS @$TASKS_FILE @$PROGRESS_FILE $(cat "$PROMPT_FILE")" | tee "$TMPFILE" || {
    echo "claude exited with an error on iteration $i" >&2
    exit 1
  }

  if grep -q "<promise>COMPLETE</promise>" "$TMPFILE"; then
    echo "Complete after $i iterations."
    exit 0
  fi
done
