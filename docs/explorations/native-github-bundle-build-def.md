# Build definition: the native-GitHub bundle

**Date:** 2026-06-02. **Status:** proposed, awaiting maintainer approval. No code
changed. Graduates to `goals/operator-automation.md` on approval.

Decisions taken (2026-06-02, operator):
- **First build:** the native-GitHub bundle (no new infrastructure).
- **Gate safety:** auto-advance the spec gate unless the plan flags something
  sensitive. The operator keeps the veto.
- **Board shape:** an inbox inside one pinned Issue (sections "Needs you" /
  "Working" / "Done"), read-only. Not a flat table, not a Projects kanban.
- **No n8n / no push channel:** the operator chose simplicity over one-tap
  interactivity. The board links to each Issue and you act there with the
  existing commands. Slack/n8n push, one-tap buttons, and the daily standup are
  declined; the checkbox-approve hack is not built (fragile).

This is the spec for that bundle, grounded in the current code. Three slices,
tracer-bullet first (the lowest-risk, purely additive one), each with exact file
anchors, acceptance criteria, and evals. Build order is deliberate: visibility
first (cannot break the live loop), then the gate change (touches safety), then
the tweak fast-path (touches safety the most).

---

## Slice A (first) — Live Mission Control

**Problem it solves:** awareness friction. Today state is scattered and the only
aggregate view is the shepherd's *weekly* snapshot
(`.claude/skills/shepherd/SKILL.md:44-72`). The operator cannot answer "what
needs me right now?" in one glance.

**Target behaviour:** one pinned `ribo:in-flight` Issue, rebuilt on every chain
event, plain-language, laid out as an **inbox**: a "Needs you" section at top
(sorted, longest-waiting first), then "Working, nothing needed", then "Done this
week". The count of needs-you items is in the Issue **title** so the GitHub tab
and notification show it without opening. Read-only: each item links to its
Issue and the operator acts there. No buttons, no n8n.

**Why it is the tracer bullet:** purely additive. It reads state and writes one
summary Issue; it cannot stall or misroute a chain. Lowest blast radius, so it
ships first and proves the pattern.

**Design — rebuild, do not patch.** The GitHub Action runs on a fresh checkout,
so `.claude/memory/live/` is not available in-Action; the source of truth is the
Issues themselves (their sticky state markers), exactly as the shepherd already
reads them (`shepherd/SKILL.md:45`). So Mission Control is *rebuilt from a scan*
of open chain Issues every time, never patched row-by-row. Idempotent by
construction; no fragile markdown surgery.

**New unit:** `src/chain/mission-control.ts` (sits beside the existing
`src/chain/state.ts`). A pure function:

```
renderMissionControl(chains: ChainRow[]): { title: string, body: string }
```

where `ChainRow` is `{ issue: number, title: string, step: string, needsYou: boolean }`.
It owns two mappings, both unit-tested so formatting never drifts:

- **Stage -> plain language** (the lab-notebook vocabulary, not git's):
  | internal step / state | operator-facing stage |
  |---|---|
  | `planner` + roadmap pending | Planning the breakdown - needs your OK |
  | `story-writer` + story pending | Waiting for your OK on the story |
  | `spec-writer` + spec pending | Waiting for your OK on the plan |
  | `spec-writer` + spec auto-approved | Building (plan needed no decisions) |
  | `builder` | Building |
  | `pr-shepherd` / `pr-opened` | Ready to merge |
  | `cancelled` | Cancelled |
- **needsYou** = any gate awaiting the operator (story pending, spec pending
  *only when held*, roadmap pending) OR PR ready to merge. This boolean now
  drives which **section** a row lands in (Needs you vs Working), not a column.

Body format (an inbox, not a table):

```
Title: Ribosome: 3 things need you            <- count lives in the Issue title

## Needs you (3)                              sorted, longest-waiting first
 1. Dark mode toggle      approve the plan        Open #41 ->   waiting 2 days
 2. Fix login redirect    ready to merge          Open #44 ->   waiting 1 day
 3. Weekly report email   approve the breakdown   Open #46 ->   waiting 4 hours

## Working, nothing needed
    Export to CSV         building
    Tooltip wording       building (plan needed no decisions)

## Done this week
    Add dark logo         merged yesterday

Last updated <ISO>, refreshes on every step
```

The renderer also computes the title string (`Ribosome: N things need you`, or
`Ribosome: all clear` when N is 0) so the coordinator sets it on the upsert.

**Files to change:**
- `src/chain/mission-control.ts` (new) + `src/chain/mission-control.test.ts` (new).
- `.claude/skills/coordinator/SKILL.md`: add a final responsibility after each
  step ("Rebuild Mission Control"): scan open chain Issues, parse each sticky
  marker, call the renderer via `node`, upsert the `ribo:in-flight` Issue. Anchor
  the new section after the "Operator-visible comments" section (`:96-104`).
- `.claude/skills/shepherd/SKILL.md`: weekly mode becomes reconcile-and-prune
  (drop merged/cancelled rows), reusing the same renderer rather than its own
  ad-hoc table (`:44-72`). Removes duplicate formatting logic.
- `OPERATOR.md`: one line under "What happens after you submit" pointing at the
  pinned Mission Control Issue as the single place to see everything (`:36-40`).

**Acceptance criteria:**
1. `renderMissionControl` is pure and unit-tested: stage mapping, needsYou logic,
   empty-list case, stable column order.
2. After any chain step, the `ribo:in-flight` Issue reflects that chain's current
   stage in plain language within one event.
3. Exactly one `ribo:in-flight` Issue exists (upsert, never duplicate) - matches
   the shepherd's existing idempotence contract (`shepherd/SKILL.md:74-77`).
4. Typecheck clean; new unit tests pass; existing 52 unchanged.

**Evals to add:** R15 (coordinator names the Mission Control rebuild as a step),
T15 (renderer maps every internal step to a plain-language stage; no raw
`current_step` strings leak to the operator surface).

**Risks:** scanning all open chain Issues adds a few `gh` calls per step (cheap).
Pinning the Issue needs the GraphQL `pinIssue` mutation (`gh` has no `pin`
verb) - do it once in setup, or skip pinning and link from OPERATOR.md/README.

---

## Slice B — Spec gate auto-advances unless flagged

**Problem it solves:** decision friction + a gate that gets rubber-stamped. The
gate the operator reliably waves through (gate 2, the spec) becomes
exception-only. Wrong assumptions are caught cheapest at gate 1 (story), which is
untouched.

**Current behaviour:** `/approve` on a pending story runs `spec-writer`, posts
"Spec for review (gate 2)", and *always* waits
(`coordinator/SKILL.md:43`, `:63`).

**Target behaviour:** `spec-writer` emits a triage verdict. If nothing sensitive
is flagged, the coordinator auto-advances to the builder and posts a one-line
notice; the operator keeps the veto via `/changes`. If something is flagged, it
holds at gate 2 exactly as today, listing the flagged decisions.

**The flag list (what forces a human stop)** - reuses the `operator-translation`
triage axis (domain/risk), made explicit:
new persistent storage of personal data; a new third-party service; a new email
sender / outbound address; a new dependency; anything touching authentication or
payments. Any one present -> hold. None -> advance. This list is the contract;
it lives in the spec-writer skill and is quoted in OPERATOR.md so the operator
knows exactly when he will and will not be stopped.

**JSON contract (mirrors the researcher/validator pattern,
`coordinator/SKILL.md:73-94`):** `spec-writer` ends its reply with

```json
{ "needs_operator": false, "flags": [] }
```

or `{ "needs_operator": true, "flags": ["new third-party service: SendGrid"] }`.
The coordinator parses the last JSON block (existing convention) and branches.

**Honest audit trail:** when auto-advanced, the state records
`gate_state.spec: "auto-approved"` (distinct from `"approved"`), so
`npm run chain:show` and Mission Control both show the gate was not an explicit
human yes. This keeps rule "no fabricated approvals" honest.

**Pull-back path:** add a dispatch row for `/changes` while
`current_step: builder` and `gate_state.spec: "auto-approved"` -> stop the
builder, return to `spec-writer` with the note, re-hold the gate. This is the
veto the operator keeps; without it, auto-advance would be irreversible.

**Files to change:**
- `.claude/skills/spec-writer/SKILL.md`: emit the `needs_operator` + `flags`
  JSON; document the flag list as the contract.
- `.claude/skills/coordinator/SKILL.md`: branch the story-`/approve` row on
  `needs_operator` (`:43`); add the auto-advance advancement rule to the JSON
  table (`:85-94`); add the `/changes`-during-auto-build pull-back row (`:46`
  neighbourhood); add `"auto-approved"` to the gate_state vocabulary (`:19`).
- `OPERATOR.md`: rewrite gate 2 (`:59-77`) - "you are only stopped here if the
  plan touches something sensitive (the bot lists the exact triggers); otherwise
  it builds and tells you, and you can still pull it back with /changes."

**Acceptance criteria:**
1. A spec with no flagged items auto-advances: no "Spec for review" gate comment;
   a one-line "building, plan needed no decisions" comment instead; state
   `spec: "auto-approved"`.
2. A spec that introduces a new dependency (or any flag) holds at gate 2 with the
   flag named in plain language.
3. `/changes` during an auto-advanced build returns to the spec stage.
4. Mission Control and `chain:show` distinguish auto-approved from approved.
5. Typecheck/tests/evals green.

**Evals to add:** TR15 (spec-writer emits the triage JSON; coordinator
auto-advances on `needs_operator:false`, holds on `true`), R16 (the flag list is
present and quoted in both spec-writer and OPERATOR.md - they must not drift).

**Risk / posture note:** this is the one slice that changes the safety posture.
It is gated correctly: the story gate (cheapest place to catch errors) is
untouched, the flag list forces a stop on exactly the categories OPERATOR.md
already says are worth flagging (`:74-76`), and the veto survives. Softens
architecture rule #6's letter ("three gates") while keeping its intent ("few
gates, not seven") - record as an ADR (`docs/adr/0004`) per the decision-records
skill, since it is a system-wide posture change.

---

## Slice C — Tweak = merge-only

**Problem it solves:** a one-line copy change going through a story gate is
theatre. The PR diff is the review surface.

**Current behaviour:** `ribo:tweak` runs researcher + story-writer and holds at
gate 1 (`coordinator/SKILL.md:41`); the story body marks the spec gate skipped.
So a tweak is two gates (story + merge).

**Target behaviour:** `ribo:tweak` goes straight to a draft PR with no pre-build
gate. The bot drafts the change; the operator reviews and merges. One gate.

**The escape hatch (keeps it boringly safe):** the auto-spec step runs the same
triage as Slice B. If it flags sensitivity, OR the change exceeds a tweak-sized
budget (proposed: > 3 files or > 40 changed lines), the fast-path *escalates*
back to the story gate and tells the operator "this is bigger than a tweak;
here is the story to approve." So a mis-filed large change cannot slip through
ungated. The safety net for a true tweak is: enforce-scope hook + validator + CI
+ the human merge.

**Files to change:**
- `.claude/skills/coordinator/SKILL.md`: split the `ribo:tweak` no-state row out
  of the shared `:41` row into its own fast-path (researcher-light -> auto-spec
  for scope only, no gate -> builder -> verify -> validator -> draft PR), with
  the escalation condition.
- `.claude/skills/spec-writer/SKILL.md`: reuse the Slice B triage; add the
  tweak-size budget check.
- `OPERATOR.md`: rewrite the Tweak bullet (`:21`) and add to gate 3 that for a
  tweak the PR is the only stop.

**Acceptance criteria:**
1. A genuine one-line tweak produces a draft PR with no story/spec gate comment.
2. A tweak that trips the size budget or a sensitivity flag escalates to the
   story gate instead of building silently.
3. The enforce-scope hook still bounds the builder (scope_paths from the
   auto-spec).
4. Typecheck/tests/evals green.

**Evals to add:** TR16 (tweak fast-path opens a PR with zero pre-build gates),
TR17 (oversized/flagged "tweak" escalates to the story gate).

**Risk:** depends on Slice B's triage existing, so it lands after B. The size
budget numbers (3 files / 40 lines) are a starting guess; tune from the first
real tweak.

---

## Build order and why

1. **Slice A (Mission Control)** - purely additive, cannot break the loop, proves
   the renderer pattern. Ship and watch.
2. **Slice B (spec auto-advance)** - the core decision-friction win; changes
   safety posture, so it gets an ADR and careful evals.
3. **Slice C (tweak merge-only)** - reuses B's triage; smallest surface, but
   highest "no gate at all" risk, so it lands last with the escape hatch.

Each slice is independently shippable and independently revertible. None
introduces new infrastructure; all three live inside GitHub + the existing
skills + `src/chain/`. The Slack/n8n push channel and the native PR-review-button
gates remain in the brainstorm doc for a later phase, deliberately after these
banked wins.

## Out of scope here
- Slack / n8n one-tap push, one-tap board buttons, the daily standup, and the
  checkbox-approve hack: **declined** by the operator on 2026-06-02 in favour of
  simplicity. The board stays read-only.
- Natural-language affirmatives / approve-from-email (still parked, low cost).
- PR-review-button gates / one-PR-per-feature (parked).
- GitHub Projects board (parked; the inbox-Issue is the chosen surface).
