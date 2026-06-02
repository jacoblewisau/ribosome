### 2026-06-01 - Planner auto-advance (sequential, rides the merge gate)

A Project now runs to completion with the operator doing nothing but merging each PR. When a slice's PR merges, the linked Issue closes as `completed`; `ribosome.yml` triggers on `issues: closed`, and the coordinator reads the slice's `Part of #<parent> - slice K of N` breadcrumb, finds the next open sibling, and labels it `ribo:feature`. The merge gate (gate 3) doubles as the advance signal, so no fourth gate. Sequential only; a cancelled slice (`not_planned`) pauses the roadmap with a recoverable note; the last slice closes the parent. See ADR-0004.

The bot-applied-label re-trigger (App/PAT token) is the one fragile link, and its failure is invisible. Guarded in three layers: (1) `setup:check` + eval TR13 assert `allowed_bots` names the bot; (2) the coordinator verifies the start in-run (`sleep` + `gh run list`) and posts either "building" or a one-click nudge; (3) the shepherd watchdog reads `pending_advance` off open roadmaps and escalates a stalled advance to the always-reliable operator-applied label.

Files: `ribosome.yml`, `planner` / `coordinator` / `shepherd` skills, `setup-check.ts`, ADR-0004, OPERATOR.md. Evals T15 / T16 / T17 / TR15. Originally on branch `claude/session-planning-3NdKu` (PR #26, closed); reconciled onto the conflict-free-state main and merged 2026-06-02.

Not yet live-verified: the slice-N to slice-N+1 advance has not run on a real Project; only the slice-1 auto-start has. The guard layers exist precisely because that path is once-validated.
