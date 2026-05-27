# Per-agent memory access matrix

Decided in PLAN.md §10. The live store is the filesystem at
`.claude/memory/live/<id>/`; the distilled store at
`.claude/memory/distilled/` is Phase 4.5. No agent writes to distilled.
Only the Dreaming pass (Phase 4.5) writes to distilled.

## Live store layout

For each chain run with id `<id>`:

```
.claude/memory/live/<id>/
  chain.json                  # state machine, version "1"
  researcher.md               # researcher's final findings
  researcher.inflight.md      # researcher in-flight notes (if a long run)
  story.md                    # story-writer's output (or stories/<id>.md by reference)
  spec.md                     # spec-writer's output (or specs/<id>.md by reference)
  builder.md                  # builder's final summary
  builder.inflight.md         # builder in-flight notes (resumption point)
  test-author.md              # test-author's summary (Phase 3+)
  validator.md                # validator's report (latest)
  validator.previous.md       # prior validator report if amended (manual)
  pr-shepherd.md              # PR-shepherd summary (Phase 3)
```

A role is "mid-run" when its `.inflight.md` exists and is newer than
its `.md`. The validator checks this and refuses to verdict against
a mid-run role.

## Per-agent access matrix

| Agent          | live read | live write (own files only)             | distilled read              | distilled write |
|----------------|-----------|------------------------------------------|------------------------------|------------------|
| researcher     | yes       | `researcher.md`, `researcher.inflight.md`| yes (none yet, Phase 4.5)    | no               |
| story-writer   | yes       | none in live (writes stories/<id>.md)    | yes                          | no               |
| spec-writer    | yes       | none in live (writes specs/<id>.md)      | yes                          | no               |
| builder        | yes       | `builder.md`, `builder.inflight.md`      | yes                          | no               |
| test-author    | yes       | `test-author.md`, `test-author.inflight.md` | yes (patterns + traps)  | no               |
| validator      | yes       | `validator.md`                           | yes (anti-patterns + traps)  | no               |
| pr-shepherd    | yes       | `pr-shepherd.md`                         | yes (operator preferences)   | no               |
| coordinator    | yes       | `chain.json`                             | no                           | no               |
| Dreaming job   | n/a       | n/a                                      | yes (consumes prior)         | yes (only writer)|

Enforcement in Phase 2.5 is convention-driven: agent prompts cite the
paths they may write. Phase 6 wires the `enforce-scope` hook to block
writes mechanically. Per Anthropic's start-simple principle, the
convention is sufficient until a real out-of-scope write happens.

## Helper module

The TypeScript helper at `src/chain/state.ts` centralises the layout
and exposes:

- `initChain(id, init)` create the directory + chain.json
- `readChain(id)` load the chain state (tolerant of legacy shape)
- `updateChain(id, patch)` atomic write
- `writeInFlight(id, role, content)` checkpoint notes for resumption
- `readInFlight(id, role)` read the in-flight notes
- `finalize(id, role, content?)` write the final report
- `readFinal(id, role)` read the final report
- `isMidRun(id, role)` true when in-flight exists and is newer than final
- `listChains()` list every chain id present

Agents do NOT call this module. They use Read / Write tools against
the documented file paths. The helper exists for scripts (chain-show,
the acceptance test) and the orchestrator skill.

## Inspection

The maintainer (not the operator) can inspect chain state from the
command line:

```
npm run chain:list           # list every chain on disk
npm run chain:show 0003      # detailed view of one chain
```

The operator (non-coder) does not interact with this; their interface
is GitHub Issues, PR comments, and the weekly Dreaming digest (Phase
4.5).
