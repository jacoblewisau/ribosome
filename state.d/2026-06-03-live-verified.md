### 2026-06-03 - Native-GitHub bundle live-verified end to end (OAuth)

Ran the bundle through real GitHub Actions on OAuth quota. All three slices
green:

- **Slice A (board):** the `ribo:in-flight` Issue rendered the inbox layout live
  (count in title, Needs you / Working / Done sections, plain-language stages),
  and after PR #46 the rebuild is one robust `--upsert` command that ran clean
  in the Action.
- **Slice B (spec auto-advances):** issue #42 (a footer feature with no flags)
  auto-advanced the spec gate (`gate_state.spec: "auto-approved"`, one-line
  notice, veto offered) and ran straight through to PR #43 in one invocation.
  Merged.
- **Slice C (tweak fast-path):** issue #47 skipped the story and spec gates and
  opened PR #49 directly; run conclusion `success`.

Two integration bugs that unit tests and structural evals could not catch were
found live and fixed:

- **PR #41** — the workflow's per-invocation "one step then STOP" prompt would
  have stalled every auto-advanced spec and every tweak (both must reach the PR
  in one invocation). Caught by inspection before it cost a run. Rewrote it to
  "one gate transition: run through a skipped/auto-advanced gate".
- **PR #46** — the board-rebuild epilogue used a shell `> file` redirect (blocked
  in the Action sandbox) and thrashed into `error_max_turns`; the gather also
  used AND-ed `gh --label` flags (matches nothing). Replaced with a single
  `scripts/mission-control.ts --upsert` command.

Test artifacts (issues #42/#44/#47, PRs #43/#45/#49) were merged or closed.
Counts after the work: 92 unit tests, eval 55/55.
