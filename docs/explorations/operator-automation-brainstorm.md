# Brainstorm: making the operator loop boringly effortless

**Date:** 2026-06-02. **Status:** exploration, not a decision. No code changed.

The brief: the operator finds two things annoying. (1) Typing `/approve` and
`/changes` over and over. (2) Keeping track of Issues, PRs, and Action runs is
"hard and confusing." Brainstorm fixes that stay robust, easy to understand,
automated, and boringly reliable. Think like the non-coder scientist who uses
this, and challenge every idea.

---

## 1. The real problem, named

Today the operator is the **integrator**. The truth about one feature is
scattered:

- the **Issue** (the request, the bot's gate comments),
- a hidden **HTML state comment** he cannot even see rendered,
- the **PR** (the result),
- the **Actions** tab (whether anything is running or stuck).

To move a feature forward he must find the right Issue, read the latest bot
comment, and type a slash command with exact syntax. None of those steps is
hard alone. The cost is that he has to **hold the whole board in his head** and
**type to move it**, and that cost grows with the number of chains in flight,
which is exactly when he has the least attention to spare.

So there are two distinct problems, and they want different fixes:

- **A. Decision friction.** Saying "yes" should not require finding a place and
  typing a command. Saying "change this" is irreducible (the change *is* the
  words), but saying "yes" is the common case and should cost one tap or less.
- **B. Situational-awareness friction.** "What is happening, and what needs me
  right now?" should be answerable in one glance, in one place, ideally
  delivered to him rather than hunted for.

## 2. North star

> **One inbox. One tap. Fewer gates. GitHub stays the boring system of record.**

The operator should be *notified* only when he is genuinely needed, act with a
single tap, and never think of Issues, PRs, and Actions as three separate
things. Everything else is invisible. GitHub remains the auditable backbone:
every approval still lands as a real event in the repo, so if any convenience
layer breaks, the plain `/approve` path still works. Convenience is **additive,
never load-bearing.** That is what keeps it boring.

Three levers get us there.

---

## Lever 1 — Fewer gates (cut the work, do not just speed it up)

The cheapest approval is the one he never has to give. Before making each gate
faster, ask whether each gate earns its interruption.

### 1a. Risk-tier the number of gates

Not every kind of work deserves three stops. The bot already triages decisions
by risk (the `operator-translation` skill). Apply that to the *gates
themselves*:

| Issue type | Gates today | Proposed |
|---|---|---|
| **Tweak** (copy, colour) | story, [spec skipped], merge | **merge only** — open the PR, he merges or not |
| **Bug** | story, spec, merge | story, merge (spec auto unless flagged) |
| **Feature** | story, spec, merge | story, merge (spec auto unless flagged) |
| **Project** | decomposition + per-child | unchanged (decomposition is the high-value gate) |

A one-line copy change going through three human gates is theatre. The PR merge
button is already a gate; for a Tweak, that is enough.

### 1b. Gate 2 (spec) becomes exception-only

OPERATOR.md already tells him "you do not need to understand every detail" at
the spec gate. His own note to himself: *volume makes him rubber-stamp.* A gate
that is reliably rubber-stamped is friction without safety. So **only stop at
the spec gate when the spec contains something the triage flags**: new personal
data, a new third-party service, a new email sender, a new dependency, anything
touching auth or payments. If the spec surfaces none of those, advance straight
from approved-story to build and tell him so in one line ("Plan had no choices
that needed you; building. Reply `/changes` to pull it back."). He keeps the
veto; he loses the rubber-stamp.

This roughly **halves** his actions on the common path without weakening the
gate that actually catches expensive mistakes (the story gate, where wrong
assumptions are cheapest to fix).

**Challenge:** this softens architecture rule #6 ("three human gates, not
seven"). Reframe, do not break it: the rule's intent is "few gates, not many."
Going from a fixed three to a risk-tiered one-to-three honours the intent. But
this is a real change to the safety posture and is **Jacob's call, not mine**
(see Decisions, below).

---

## Lever 2 — Zero-typing approval (kill the keystroke, keep the audit)

For the gates that remain, make "yes" cost one tap and zero syntax.

### 2a. Native GitHub review buttons instead of `/approve`

GitHub already has a first-class, zero-typing approval mechanism with a real
webhook event: the green **Approve** / **Request changes** buttons on a pull
request. The event is `pull_request_review` (`types: [submitted]`,
`review.state` is `approved` or `changes_requested`). It is as boringly reliable
as the `issue_comment` trigger we already use.

The move: render the **story and the spec as a single draft PR per feature** (a
PR that adds `stories/<id>.md`, then `specs/<id>.md`, then the code). The
operator reviews the PR:

- green **Approve** = advance the gate (zero typing),
- **Request changes** + a sentence = the `/changes` path, note included,
- the PR stays a **draft** until the final stage, so he cannot merge-by-accident
  early.

One **URL per feature** instead of three surfaces. Native "review requested"
shows up in his GitHub dashboard and email. Reviewing a single markdown file's
diff is just reading prose; arguably *more* intuitive for a non-coder than
remembering `/approve`.

**Variant — "the only verb is merge."** Even simpler mental model: every gate is
"merge a PR." Story PR, spec PR, code PR, each merged into the feature branch to
advance. One verb to learn. Downside: more PRs to look at, and merging prose
feels odd. The single-draft-PR-with-reviews is cleaner; noting the variant for
completeness.

**Challenge:** moving chain state from the Issue to the PR is a real
architectural change, and GitHub review approvals go "stale" (not blocking) when
a new commit lands, so the bot must re-request review after it pushes the spec
commit. Workable, has edge cases. Medium-high build cost. The payoff (collapse
three surfaces to one, remove typing) is large.

### 2b. Natural-language affirmatives (so an email reply works)

Broaden the comment parser to accept a small, safe allowlist of affirmatives at
a gate: `approve`, `yes`, `go`, `ship it`, `looks good`, a thumbs-up. GitHub
lets you **reply to a notification email to post a comment** (verify before
relying on it). If "yes" counts as approval, the operator clears a gate **from
his inbox without opening GitHub at all.** Keep the allowlist tiny and only
active when a gate is actually pending, so there is no ambiguity. `/changes`
stays explicit because its content is the whole point.

### 2c. Reactions as approval — tempting, but flag the limitation

The obvious idea: thumbs-up the gate comment to approve. **GitHub Actions has no
native reaction trigger** (no `on: reaction`), so this would require a cron poll
that scans for new reactions. That adds latency and a moving part for a marginal
gain over 2a/2b. Recommend **against** unless 2a/2b prove insufficient. (Verify
the no-reaction-trigger claim before discarding; it is stated from memory.)

---

## Lever 3 — One surface to see, one channel to be told

Attacks problem B directly: stop making him hunt across tabs.

### 3a. A live "Mission Control", not a weekly snapshot

The `shepherd` scout already posts a *weekly* in-flight summary Issue. Make it
**one pinned Issue, always current**, patched by the coordinator on every state
transition (it already posts a comment at each step; one more API call patches
the control Issue). Every chain is a row in plain language:

```
| Feature            | Stage              | Needs you? | Link |
|--------------------|--------------------|------------|------|
| Dark mode toggle   | Waiting for your OK| YES -> open| #41  |
| Export to CSV      | Building           | no         | #39  |
| Fix login redirect | Ready to merge     | YES -> open| #44  |
```

He bookmarks **one** Issue and sees the whole lab at a glance. Strictly better
than the weekly snapshot, cheap, fully native, robust.

### 3b. A GitHub Projects board (native aggregation)

A Projects v2 board with three columns — **Needs You / Working / Done** — that
items auto-move through. This is the single biggest native visibility win and
the repo has no board today. Use it as the *overview* surface; pair it with 3c
so he does not have to remember to check it.

**Challenge:** a board is still a place he must go. That is why the real answer
is push, not pull.

### 3c. Push, do not pull: one notification channel (uses n8n, already running)

The operator should not *go* anywhere. When (and only when) he is needed, one
message arrives — Slack or email — that says "Dark mode needs your OK" with
**Approve / Changes buttons inline**. He taps once. Slack interactive buttons
(Block Kit) need an endpoint to receive the tap; pure GitHub Actions cannot.
**But Jacob self-hosts n8n** (`https://n8n.srv1198134.hstgr.cloud/`), which is
built exactly for this:

```
GitHub gate reached
      -> n8n webhook
      -> Slack message with [Approve] [Changes] buttons
      -> operator taps Approve
      -> n8n posts "/approve" comment back to the Issue
      -> normal chain advances
```

The decision moves to wherever is lowest-friction (a Slack tap), while GitHub
stays the system of record. **Graceful degradation is the whole point:** if n8n
is down, the Slack message simply does not arrive and he uses GitHub directly.
The push channel is a convenience, never a dependency. That preserves "boringly
reliable."

Slack integration is already on the roadmap (carried from session 4,
"documented, not wired"). This is the moment it earns its place.

### 3d. The daily standup (batch the gates)

A scientist runs a lab by reviewing the queue once, in the morning. Combine
auto-advance (Lever 1) with batching: instead of N scattered pings, the bot
sends **one** message per day listing everything that needs him:

```
Good morning. 3 chains need you:
  1. Dark mode toggle    - approve the plan?
  2. CSV export          - approve the story?
  3. Login fix           - ready to merge

Reply: "approve 1 2", "changes 3: keep the old colour", or open any.
```

One interaction per day instead of N interruptions through the day. Because
low-risk gates auto-advance, the list only ever holds things that *genuinely*
need him. This attacks both problems at once: less typing, and a single place
that says exactly what is outstanding.

---

## 3. What I would build first (boring-first sequencing)

Order chosen to add value early while introducing zero new infrastructure
before native GitHub is exhausted.

1. **Live Mission Control Issue (3a) + Gate-2-on-exception (1b) + Tweak =
   merge-only (1a).** All inside GitHub, no new servers, immediate relief on
   both problems. Lowest risk, highest ratio. Half the approvals disappear and
   "what needs me" becomes one pinned Issue.
2. **Natural-language affirmatives (2b).** Tiny parser change; unlocks
   approve-from-email. Cheap, high daily value.
3. **Projects board (3b).** Native overview for when he wants the whole picture.
4. **Slack + n8n push with one-tap approval (3c) + daily standup (3d).** The big
   experience win; introduces the one external dependency, kept strictly
   additive so it can never block the loop.
5. **Native PR-review gates / one-PR-per-feature (2a).** The largest
   architectural change; do it last, once the cheaper wins are banked and we
   know whether it is still worth it.

## 4. Decisions only Jacob can make

These change the safety posture or the product shape; they are his, not mine.

1. **Is silent consent acceptable for low-risk gates?** Auto-advance the spec
   gate (and maybe auto-advance after a veto window) unless the triage flags a
   real concern. Halves the approvals but means some work proceeds without an
   explicit "yes." Yes/no, and where to draw the risk line.
2. **Move the gate from typed commands to native GitHub buttons (PR reviews)?**
   Bigger change, biggest comprehension win, but reshapes the chain. Worth it,
   or keep slash commands and just make them easier to reach?
3. **Push channel: Slack, email, or both?** n8n can drive either. Slack gives
   real buttons; email gives reply-to-approve with no new app to open.
4. **Should Tweaks skip straight to a mergeable PR with no story/spec gate?**

## 5. Ideas considered and set aside (the challenge log)

- **Reaction-to-approve (2c):** no native trigger, needs polling, marginal gain
  over email-reply. Parked.
- **Checkbox-to-approve** (toggle a task-list checkbox in an Issue, fires
  `issues: edited`): real but fragile (diffing checkbox state), and a worse
  version of the Mission Control + buttons idea. Rejected.
- **Replace GitHub as the operator surface:** the brief says "using GitHub," and
  GitHub-as-record is the source of the robustness. The right split is to move
  the *interaction* off GitHub (Slack tap, email reply) while keeping GitHub the
  *record*. Not a replacement.
- **Seven-stage approval / per-file review:** the opposite of the goal. The
  whole thrust is fewer touches, not more granular ones.

---

## One-line summary

Stop making the scientist integrate three surfaces and type to move them. Cut
the gates that get rubber-stamped, turn "yes" into one tap (native button, "yes"
email reply, or a Slack button via the n8n he already runs), and give him one
live place that says exactly what needs him. GitHub stays the boring backbone so
every convenience can fail without stopping the line.
