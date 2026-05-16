#!/bin/bash
set -e

PROMPT_FILE=""
TASKS_FILE=""
PROGRESS_FILE=""

usage() {
  echo "Usage: $0 -p prompt -f tasks -r progress <iterations>"
  exit 1
}

while getopts ":p:f:r:" opt; do
  case $opt in
    p) PROMPT_FILE="$OPTARG" ;;
    f) TASKS_FILE="$OPTARG" ;;
    r) PROGRESS_FILE="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND - 1))

{ [ -z "$PROMPT_FILE" ] || [ -z "$TASKS_FILE" ] || [ -z "$PROGRESS_FILE" ] || [ -z "$1" ]; } && usage

read -r -d '' RALPH_INSTRUCTIONS <<'EOF'
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

for ((i=1; i<=$1; i++)); do
  result=$(claude --dangerously-skip-permissions -p "$RALPH_INSTRUCTIONS @$TASKS_FILE @$PROGRESS_FILE $(cat "$PROMPT_FILE")")
  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Complete after $i iterations."
    exit 0
  fi
done
