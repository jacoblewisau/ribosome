# 0003. Lab data stays on each person's machine; only summaries may leave

- Status: accepted
- Altitude: system-wide (binds the whole lab-data-analyst project, Issue #6, and every slice under it)
- Decided: 2026-05-30
- Decided by: operator at the decomposition gate (project #6, on /approve)

## Context

Project #6 is a tool where lab members upload a spreadsheet of experimental data,
ask questions about it in plain English, and get short answers plus simple charts.
The data can be unpublished results, so the operator's hard constraint is that it
must stay private to the lab and never be sent anywhere the lab does not control.
Answering a plain-English question, however, requires calling an outside AI
service, which is the one place data could leave a person's machine. The
decomposition forced a choice about what, if anything, may be sent.

## Decision

The tool runs per person in the browser: each person opens it on their own
computer and the raw data stays on the machine of whoever opened it. There is no
shared server holding lab data. To answer a plain-English question, the tool may
send to the outside AI service only summaries of the data, meaning column names,
column types, and computed numbers such as averages, counts, and ranges. The raw
rows never leave the machine.

## Alternatives considered

- Send the raw rows too. Any question becomes answerable, but unpublished rows
  would leave the lab's control. Rejected: the operator requires the rows never
  leave the machine.
- Send nothing, ever (keep upload plus chart only, drop plain-English questions).
  Maximal privacy but no chat feature. Rejected: the operator wants the chat and
  accepts the summaries-only limit on what it can answer.
- One shared website the whole lab logs into. Simpler to distribute, but it
  centralises the data off each person's machine. Rejected: the operator chose
  per-person, browser-local hosting.

## Consequences

Makes easy: a privacy story the operator can state plainly; slices 1 (upload and
view) and 2 (chart a column) ship fully local with nothing leaving any machine.
Makes hard: slice 3 (ask in plain English) and slice 4 (auto-draw a chart) must
compute summaries on the client and send only those; the AI integration cannot
fall back to shipping rows, even for a question that would be easier to answer
with them. Commits us to: a per-person browser deployment with no server that
holds lab data, and a summaries-only boundary to any external model. Revisit if:
an in-house or self-hosted model becomes available (raw rows could then stay
in-house), or the operator's privacy needs change.
