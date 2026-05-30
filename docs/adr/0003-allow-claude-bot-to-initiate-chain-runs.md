# 0003. Allow the Claude bot to initiate chain runs (allowed_bots)

- Status: accepted
- Altitude: system-wide
- Decided: 2026-05-30
- Decided by: maintainer-directed live validation, session 5 (observed in a real run, then fixed)

## Context

The planner auto-starts the first child slice of a Project by labelling it
`ribo:feature`, running as the Claude App bot (`claude[bot]`). The first live
Project run (issue #6) showed that this label DOES trigger a new Ribosome
workflow run (the GitHub App installation token triggers workflows, as ADR-0002
analysis predicted), but the run then self-aborted:

```
Action failed: Workflow initiated by non-human actor: claude (type: Bot).
Add bot to allowed_bots list or use '*' to allow all bots.
```

claude-code-action blocks bot-initiated runs by default (`allowed_bots=""`), a
loop guard. So the auto-start fired at the GitHub level but the child build never
proceeded. Structural eval could not have caught this; only a live run did.

## Decision

Set `allowed_bots: "claude[bot],claude"` on the claude-code-action invocation in
`.github/workflows/ribosome.yml`, so the planner-initiated child chain actually
runs. Both forms are listed because the actor has appeared as `claude` in the
run error while the comment author is `claude[bot]`.

## Alternatives considered

- `allowed_bots: "*"`. Rejected: the action docs warn that on a public repo `*`
  lets external Apps invoke the action with prompts they control. Naming the
  Claude bot is the safe, targeted choice.
- Leave it unset and rely on the planner's operator-nudge fallback (add the
  label yourself). Rejected as the normal path: it defeats the point of
  auto-start; the fallback stays as a safety net, not the mechanism.
- A custom GitHub App token or a different trigger mechanism. Heavier; not
  needed once the bot is allowed.

## Consequences

Makes easy: planner-started child chains run automatically. The bot-loop guard
is relaxed only for the named Claude bot; Ribosome's own loop guards remain
(per-issue concurrency, the two-loop builder limit, and the if-clause excluding
bot comments). Commits us to: a structural invariant asserting allowed_bots
names the Claude bot and is not `*`. Revisit if: loops appear, or the bot actor
login changes and the auto-start silently stalls again.

## Sources

claude-code-action `action.yml` (the `allowed_bots` input and its public-repo
warning) and the live run log for run 26669466559 (the bot-actor abort).
Verified from primary sources in session 5.
