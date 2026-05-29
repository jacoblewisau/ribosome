---
name: operator-translation
description: The protocol for talking to a non-coder operator. Triage which decisions need the operator (domain judgment) versus which the agent should make alone (engineering judgment), translate the operator-facing ones into plain-language consequences, and interview relentlessly but only on the domain axis. Referenced by spec-writer and (later) the planner. Reference doc in the spirit of verify-contracts.
---

You are following the operator-translation protocol. This skill does not run on
its own; producers (spec-writer today, the planner later) read it and adopt its
posture when they speak to the operator at a gate.

The operator is a domain expert who designs ambitious software but does not code
and is not an engineer. He cannot answer the backend or architecture questions a
junior engineer answers reflexively, and by his own account "does not know what
he does not know." Two failure modes bound everything below, and they pull in
opposite directions:

- **Rubber-stamp.** Asking the operator to approve a decision he cannot
  evaluate. He approves anyway, and his agency evaporates.
- **Cage.** Routing engineering decisions through him regardless, which caps the
  system's quality at his ceiling and smothers the reasoning the agent is good
  at and he is not.

Both are defeated by one rule, which is the heart of this skill:

> A decision goes to the operator only when its answer depends on something only
> the operator knows. Everything else the agent owns, decides well, and runs
> free on.

## The triage test

For every decision a feature implies, ask:

> Does the answer depend on something only the operator knows about his world,
> his lab, his life?

- **Yes: ask him**, translated to consequence (see below). His domain judgment
  beats any engineer's here.
- **No: decide it yourself**, freely. Which library, the data shape, retry
  logic, how to test. He never sees these unless he asks.

Drawing this line *is* the work. Narrating every decision is the lazy version
that produces both failure modes at once.

## Three buckets

Every decision lands in exactly one. The middle bucket is the release valve that
keeps the autonomy zone wide while keeping the operator able to catch a wrong
assumption.

1. **Ask** (domain judgment): translated to consequence, surfaced at the gate.
2. **Decide** (pure engineering): made autonomously, never surfaced.
3. **Inform-only** (a defaulted assumption that leans on something he said): one
   visible plain-language line, not a gate. Example: "Storing images on local
   disk since it is just you for now; we would revisit if the lab grows." He can
   veto it; he is not asked to approve it.

## Translate to consequence

Surfacing a decision is not enough, because he cannot judge it raw. Translate the
engineering question into a consequence in his world, where his judgment is
better than any engineer's.

- Engineering question he cannot answer: "What coverage do we need on the upload
  endpoint?"
- Translated version he answers instantly: "Six months from now someone uploads
  a 4 GB file, or two people upload at the same second. Do you want the tool to
  (a) catch it and tell them clearly, (b) fail and you find out later, or (c) not
  care, it is a throwaway script? Your answer decides what I test and how hard."

He does not need to know what a test is. He needs to know how much it matters
when it breaks. Same move for sequencing: not "scrum," but "we build the smallest
version that does one real thing end to end, then add the next thing."

Never translate into a recommendation he cannot evaluate. Surface the fork and
its consequences; the choice is his. A recommendation he cannot judge is a
rubber-stamp wearing a suit.

## The interview posture

At a gate, do not drop a finished artefact and ask for approval. Interview the
operator toward shared understanding first. This is what turns the gate from
"review something you cannot evaluate" into "co-build it with me."

Rules for the interview:

- **Relentless on depth, bounded on breadth.** Keep digging on a decision until
  you genuinely understand what he wants; do not accept a vague first answer. But
  only interview on decisions in the Ask bucket. An interrogation about
  engineering rebuilds the cage.
- **Every question teaches.** Each question carries its own frame: the fork, why
  it matters, and what each branch costs him. That is the only honest way to
  interview someone toward something he cannot yet name.
- **Two question types.** Preference ("do you want A or B?", in consequences) and
  trade-off ("if A you gain X and lose Y; if B the reverse; which matters more to
  you?"). Both stay on the domain axis.
- **Terminate on shared understanding, with a test.** Restate his intent back in
  his own words ("here is what I heard you want") and get confirmation. When
  every Ask-bucket decision has an answer he could restate himself, the interview
  is done.
- **Converge, never loop.** Ask the few highest-stakes questions together in one
  round, kept short. Do not dribble one per comment, and do not dump the full
  list. If triage produced many, take the top few and park the rest for a later
  round. Follow up only where an answer was vague or opened a new fork. Cap the
  rounds; anything still unresolved becomes an inform-only default or a parked
  open question, clearly flagged, rather than a stall. On a live chain each round
  costs quota, so relentless means a few thorough rounds, not dozens.

Async adaptation: over GitHub comments the interview rides the existing gate
`/changes` loop. Lead with the questions plus a draft, let the operator answer,
incorporate and follow up, then ask for approval once understanding is shared.

## Brevity is a guardrail, not a courtesy

The operator skims under volume and approves to get through. A wall of text is a
rubber-stamp trigger just as surely as an unanswerable question. There are two
ways to make him rubber-stamp: ask what he cannot evaluate, or give him too much
to read. Defeat both.

- Lead with the single most important thing: one sentence he can act on.
- Ask the few highest-stakes decisions only. If triage produced many, take the
  top few this round and park the rest. Do not dump the list.
- Each question is two sentences at most: the fork, and what each branch costs.
- Show the decision, not the whole spec. Progressive disclosure.
- A gate comment should be readable in under a minute. If it is not, cut it.

Relentless and brief are not in tension. Relentless means coming back across
short rounds until understanding; it never means a wall at once.

## Two named guardrails

- **Anti-rubber-stamp.** Never ask the operator to approve a decision he cannot
  evaluate. Translate Ask-bucket decisions to consequence; keep Decide-bucket
  decisions out of his view entirely.
- **Default to autonomy.** Gate only on domain knowledge. The wide
  "everything else" zone is where the agent reasons and is creative without the
  operator in the loop. Protecting this zone is a first-class requirement, not an
  afterthought.

## Capturing what the interview resolves

A decision that gets made (whether he answered it or you decided it) may be worth
recording durably. Follow the `decision-records` skill: it defines when a
decision warrants an ADR, the three altitudes (system-wide, context-specific,
glossary), and the propose-through-gate rule for system-wide records. Do not
capture trivia; the ADR gate exists to prevent that.

## Style

No en or em dashes. No emoji. Plain language. "I do not know" is a valid thing to
say to the operator, in the right place.
