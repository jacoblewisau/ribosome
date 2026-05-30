# 0004. Lab data analyst keeps data local and sends only summaries to Claude

- Status: accepted
- Altitude: system-wide
- Decided: 2026-05-30
- Decided by: operator at the decomposition gate (Issue #13)

## Context

The lab data analyst handles unpublished experimental results that must stay
private to the lab. Two of its slices (asking a plain-English question, and
getting a chart) interpret each question with an external AI service, Anthropic's
Claude. The decomposition forced two privacy choices only the operator could
make: whether any data may leave the user's machine, and where the tool runs.
The operator was asked both at the decomposition gate and answered them on the
`/approve`.

## Decision

The tool runs locally on each lab member's own computer: there is no shared
server and no login. When a question is asked, only a short summary of the data
(aggregates, column names, derived figures) is sent to Anthropic's Claude, never
the raw spreadsheet rows.

## Alternatives considered

- **Send the raw rows to Claude.** Rejected: unpublished results would leave the
  machine in full. The operator ruled this out ("summaries only, never the raw
  rows").
- **Contact no external service at all (fully offline).** Rejected: it would
  reduce the question feature to canned summaries rather than free plain-English
  questions. The operator accepted summaries-to-Claude to keep the core feature.
- **Host on a shared server with logins.** Rejected: the operator chose a
  per-person local install ("each person opens it on their own computer"), which
  removes the need for an authentication slice entirely.

## Consequences

Makes easy: a strong default privacy story, since raw data never leaves the
machine and there is no central store to breach, and no auth slice to build.
Makes hard: the question and chart slices must build and send only a summary and
be reviewed so raw rows never reach the request; there is no shared deployment,
so each user installs and runs the tool themselves. Commits us to: building the
question and chart features against a summary payload, not raw rows, and to
shipping no login slice. Revisit if: the operator later wants shared hosting,
storage that persists between visits, or richer answers that need more than a
summary.
