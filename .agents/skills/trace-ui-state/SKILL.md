---
name: trace-ui-state
description: Trace ambiguous or timing-sensitive UI bugs by correlating input events, visible behavior, console logs, and internal state transitions. Use after validation when a bug looks race-like, intermittent, or visibly inconsistent with the apparent code path.
---

# Trace UI State

Use this skill when an issue is ambiguous, timing-sensitive, race-like, or visibly inconsistent with the current code path.

## Shared platform

Read:

- `.agents/skills/_functional-qa/references/classification-rules.md`
- `.agents/skills/_functional-qa/references/evidence-strategies.md`
- `.agents/skills/_functional-qa/references/game-browser-playbook.md` when tracing `/game`
- `.agents/skills/_functional-qa/config/repo-adapter.json`

The shared runtime is:

```bash
python .agents/skills/_functional-qa/scripts/qa_runtime.py
```

## Target input

Use the invocation arguments as the issue, URL, or surface name to trace.

## Workflow

1. Initialize a trace run:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py init-run trace-ui-state --target "$ARGUMENTS"
   ```

2. Start from the matching validation run if one exists.

   If the run contains `browser-playbook.md`, follow it for the capture sequence and use the generated browser scripts from `browser/`.

3. Capture a correlated timeline:

- user input timestamp
- visible UI before and after
- console output
- relevant internal state or branch logs

   When tracing a tap, reveal, or timing-sensitive transition, emit explicit cue timestamps for important state changes if the runtime can provide them, for example `token_tapped_at_ms`, `tooltip_opened_at_ms`, `card_rendered_at_ms`, or `audio_started_at_ms`.

4. Prefer existing logging and debug hooks from the repo adapter before adding new instrumentation.

5. If you add temporary instrumentation, keep it targeted and remove it before finishing.

6. Write:

- `summary.md` with the traced timeline and likely root-cause candidates
- `steps.md` with the exact reproduction sequence
- `evidence.json` with temporal capture, logs, and open questions

7. Finalize the run with a verdict of `ambiguous`, `reproduced`, `partially-reproduced`, or `blocked` unless the trace fully resolves the issue.

## Output requirements

- Do not guess at root cause.
- If the issue remains unresolved, say exactly which state transition or evidence gap is still missing.
- Point back to the validation run when the trace is a follow-up.
- Prefer deterministic state cues over post-hoc video interpretation. Use video-understanding or OCR only when the runtime cannot expose the needed state transition directly.
