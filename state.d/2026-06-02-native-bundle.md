### 2026-06-02 - Native-GitHub automation bundle

Made the operator loop boringly effortless without new infrastructure. The
operator chose GitHub-native, read-only, no n8n. Three slices, all verified
programmatically (typecheck, 88 unit tests, 55-task eval gate green).

- **Slice A, live Mission Control.** One pinned `ribo:in-flight` Issue, rebuilt
  from scratch on every chain step, laid out as an inbox (Needs you / Working /
  Done this week) with the needs-you count in the title. Pure renderer
  `src/chain/mission-control.ts` (20 tests) wrapped by
  `scripts/mission-control.ts` (`npm run chain:board`); coordinator and shepherd
  both rebuild via the one renderer (shepherd's hand-built table retired).
  OPERATOR.md points at the board. Evals R16 / T19 / TR17.
- **Slice B, spec gate auto-advances unless flagged.** Gate 2 is exception-only:
  spec-writer names sensitive-category flags, the coordinator runs the
  deterministic `scripts/triage.ts spec-gate` (`src/chain/triage.ts`, 10 tests)
  and either holds (any flag) or auto-advances, recording
  `gate_state.spec: "auto-approved"` (distinct from `approved`). Operator keeps
  the veto via a `/changes` pull-back. OPERATOR gate-2 reframed. ADR-0005.
  Evals R17 / T20 / TR18.
- **Slice C, tweak = merge-only.** `ribo:tweak` skips the story and spec gates;
  over the tweak-size budget (3 files / 40 lines) or any sensitive flag
  escalates to the story gate (`scripts/triage.ts tweak-size`). OPERATOR tweak
  bullet + gate-3 reframed. Eval TR19.

Parked deliberately (see `docs/explorations/native-github-bundle-build-def.md`):
Slack/n8n push, one-tap buttons, the daily standup, approve-from-email,
PR-review-button gates, the Projects board. Remaining: a live chain run to prove
the coordinator wires the triage CLIs and rebuilds the board in a real Action.
