---
description: Consult the Opus advisor on a hard architectural question. Use when stuck on concurrency, state machines, data modeling, or non-obvious trade-offs.
---

Dispatch the `advisor` subagent with the following question. Include any relevant file paths so the advisor can read context directly — do not paste large code blocks into the question.

The advisor returns short strategic guidance, not code. After it responds:

1. Apply its recommendation in the current session.
2. If the recommendation is unclear or you disagree, ask one follow-up via `/advise` — do not engage in extended back-and-forth.
3. If the recommendation conflicts with the spec, surface the conflict to the user before implementing.

---

**Question for the advisor:**

$ARGUMENTS
