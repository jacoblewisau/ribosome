# 0004. Planner auto-advance rides the merge gate, sequentially

- Status: accepted
- Altitude: system-wide
- Decided: 2026-06-01
- Decided by: maintainer (design), session 6

## Context

The planner decomposes a Project Issue into a sequence of child Feature slices
and starts only the tracer bullet (ADR-0002). The remaining slices were filed
unlabelled with a "queued; starts when #<previous> merges" note, but nothing
advanced them: the operator had to label each next slice by hand. The open
question was how to start slice N+1 automatically when slice N ships, without
adding a fourth human gate and without inventing a new ignition mechanism.

## Decision

Auto-advance rides the existing merge gate. When the operator merges a slice's
PR (gate 3), GitHub closes the linked Issue (`Closes #<issue>`) with
`state_reason: completed`. The `ribosome.yml` workflow now also triggers on
`issues: closed`; the coordinator reads the closed slice's `Part of #<parent> -
slice K of N` breadcrumb (stamped by the planner), finds the next open sibling
in the parent's sub-issue order, and labels it `ribo:feature`. That bot-applied
label re-triggers the chain via the same App/PAT-token path the first slice
already uses (ADR-0003).

- **No new gate.** The operator merging slice N is already gate 3; that merge is
  the signal to start N+1. Three gates stay three (CLAUDE.md rule 6).
- **Sequential only.** One slice at a time, in filing order. Parallel/dependency
  graphs are explicitly out of scope.
- **Cancelled slice pauses, does not skip.** A close with `state_reason` other
  than `completed` (e.g. `not_planned`) posts a recoverable pause note on the
  parent and does not advance.
- **Last slice closes the parent.** When no open sibling remains, the coordinator
  posts a completion summary and closes the Project Issue. The close `if`-branch
  matches only `ribo:feature|bug|tweak`, never `ribo:project`, so closing the
  parent cannot re-trigger the workflow (no loop).

## The re-trigger risk and how it is guarded

The one fragile link is the bot-applied-label re-trigger: GitHub does not
re-fire workflows from the default `GITHUB_TOKEN`, only from an App/PAT token,
and the failure mode is invisible (a silent stall). Three layers convert silence
into an actionable, recoverable signal:

1. **Regression guard.** `npm run setup:check` asserts `allowed_bots` names the
   Claude bot and is not the unsafe `"*"`; eval TR13 guards the same in
   `ribosome.yml`. This is the precondition that makes the re-trigger work at all.
2. **Same-run verification.** After labelling the next slice, the coordinator
   waits ~75s and checks `gh run list` (and the target's state comment) for a
   fresh run. It posts either "slice building" (confirmed) or a one-click nudge
   (not confirmed). The next slice is a different Issue number, so its run is in a
   different concurrency group and starts immediately rather than queueing.
3. **Watchdog backstop.** The shepherd scout reads `pending_advance` off open
   roadmaps; if a queued slice stays unstarted past 30 minutes it escalates with
   a nudge on the parent. It does not re-label (a bot relabel hits the same token
   caveat); it routes to the operator-applied label, which always triggers.

## Alternatives considered

- **Start slice N+1 inline** in the same run that handles slice N's close (label
  becomes a marker, not the ignition; all later progress rides human-actor
  `/approve` events). This eliminates the re-trigger dependency entirely but
  breaks the coordinator's "one run = one event = one Issue" invariant, which two
  earlier stall fixes were earned from. Rejected: trading a known, monitored,
  one-click-recoverable risk for a novel execution model with unknown failure
  modes is the wrong trade.
- **A dedicated advance workflow** separate from the coordinator. Rejected: the
  coordinator is the chain-progression engine; a second engine duplicates state
  parsing and the concurrency model.
- **Parallel slices** behind a dependency graph. Deferred: needs per-slice
  dependency declarations and concurrency rework; sequential covers the common
  case and matches the planner's existing "starts when previous merges" promise.

## Consequences

Makes easy: a Project runs to completion with the operator doing nothing but
merging each PR; the roadmap and its progress live in one Issue that closes
itself. Makes hard / commits us to: the breadcrumb stamp on every child
(without it the roadmap cannot navigate), the `Bash(sleep:*)` allowance for the
verification step, and the three guard layers (a structural eval, T15/T16/T17/
TR15, keeps them present). Revisit if: the App-token re-trigger proves
unreliable in practice (then promote inline-start), or projects routinely need
parallel slices (then design the dependency graph).

## Sources

GitHub Actions docs: events that trigger workflows (the GITHUB_TOKEN
no-recursion rule), `issues` event `closed` action and `state_reason` field,
linked-issue closing on PR merge. ADR-0002 (sub-issues roadmap), ADR-0003
(allowed_bots). Verified from primary docs in session 6.
