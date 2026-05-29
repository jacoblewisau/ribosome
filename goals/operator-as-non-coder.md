# Goal: Operator as non-coder, and the absent interpreter

Status: slice 1 built, session 5 (2026-05-30). The coaching protocol
(`operator-translation`), the decision-capture convention (`decision-records`),
the seeded `CONTEXT.md` glossary and first ADR, and the spec-writer gate-2
enrichment are shipped and structurally eval-guarded (R12, T11, TR11, T12 added;
suite 30 to 34). The brevity guardrail (volume is a rubber-stamp trigger for
this operator) is part of the protocol. Slice 2 (the planner) has its key
decisions pre-settled but is not yet scheduled. This goal introduces no new
agents: the coaching layer and the planner are both skills.

This doc reframes who Ribosome is for and adds the one role the chain never
had. It is the largest conceptual change since the chain itself, so it is
written as a goal, to be built in slices behind the three human gates.

---

## The problem, stated honestly

Ribosome's operator profile (CLAUDE.md "Identity") describes a non-coder who
works through GitHub only. True, but it understates the situation. The real
operator:

- designs ambitious software, apps, and tools for a lab and for life, many of
  them large undertakings,
- does not write code and is not a software engineer,
- cannot answer the backend and architecture questions even a junior engineer
  answers reflexively,
- and, in his own words, "does not know what he does not know."

The chain as built assumes two things that are false for this operator:

1. **That a well-formed, correctly-sized Issue already exists.** The operator
   opens one of three templates (Feature, Bug, Tweak) and the chain runs from
   there. But turning "a tool where my lab uploads and tags microscopy images"
   into a sensibly-sized, sequenced set of buildable Issues is itself the hard
   part, and it is the part the operator cannot do. The chain starts one step
   too late.

2. **That the operator can evaluate the artefacts at the gates.** Gate 1 (story)
   and gate 2 (spec) ask for `/approve` or `/changes`. But a non-coder cannot
   judge a spec. So the gates, as built, are theatre for this operator: he
   rubber-stamps them because he has no basis to do otherwise. The gates
   protect the maintainer, not the operator.

OPERATOR.md already half-admits both gaps. It tells the operator to flag, at
gate 2, "anything that talks about storing personal data in a new place" (an
embryonic translate-to-consequence instinct), and it states plainly that the
bot "is bad at deciding whether the plan is the right plan" (the missing
upstream layer, named but not filled).

---

## The principle: translate to consequence, but only at the boundary

The missing role is not an agent. It is a person. On a real team building this
software there is a tech lead or senior engineer whose entire job is to stand
between the non-technical stakeholder and the machine: decide what to build
first and why, name the decision the stakeholder is actually making, translate
engineering into consequences and consequences back into engineering. Ribosome
automated the builders and never automated the interpreter.

Two failure modes bound the interpreter's job, and they pull in opposite
directions:

- **Rubber-stamp.** Asking the operator to approve engineering decisions he
  cannot evaluate. He approves anyway, and his agency evaporates.
- **Cage.** Routing engineering decisions through him regardless, which caps the
  whole system's quality at his ceiling and smothers the agent's reasoning and
  creativity, the one thing it is good at that he is not. (This is also a known
  passivity trap: coax an agent to check in constantly and it stops reasoning
  and starts deferring.)

These are the same boundary seen from two sides. Both are defeated by one rule:

> A decision goes to the operator only when its answer depends on something only
> the operator knows. Everything else, the agent owns, decides well, and runs
> free on.

So the design is not "translate everything." It is **triage**, and drawing that
line is the interpreter's real work. Narrating every decision is the lazy
version that produces both failure modes at once.

### The encodable test

> Does the answer depend on something only the operator knows about his world,
> his lab, his life?

- **Yes, ask him**, translated to consequence. (Is this data confidential? Just
  you, the whole lab, or outside collaborators? How bad is it if it breaks?) His
  domain judgment beats any engineer's here.
- **No, the agent decides**, freely and creatively. (Which library, the data
  shape, retry logic, how to test it.) He never sees these unless he asks.

### Three buckets, not two

The middle bucket is the release valve that keeps the autonomy zone wide while
keeping the operator able to catch a wrong assumption.

1. **Ask** (domain judgment): translated to consequence, surfaced at a gate.
2. **Decide** (pure engineering): made autonomously, never surfaced.
3. **Inform-only** (a defaulted assumption that leans on something he said):
   one visible plain-language line, not a gate. Example: "Storing images on
   local disk since it is just you for now; we would revisit if the lab grows."
   He can veto it; he is not asked to approve it.

### Two named guardrails, side by side

- **Anti-rubber-stamp.** Never ask the operator to approve a decision he cannot
  evaluate. Translate domain decisions to consequence; do not surface
  engineering-only decisions to him at all.
- **Default to autonomy.** Gate only on domain knowledge. The wide
  "everything else" zone is where the agent reasons and is creative without the
  operator in the loop. Protecting this zone is a first-class requirement, not
  an afterthought.

This is already the project's philosophy. CLAUDE.md rule 6: "Three human gates,
not seven. Everything else runs." This goal does not add gates to the build
chain. It makes sure the existing gates contain domain decisions, and that the
"everything else" zone stays genuinely autonomous.

---

## The map: what the operator does not know he does not know

Naming these is the thing the operator cannot do for himself, so the interpreter
must. None of these are architecture. An engineer carries all of them
implicitly.

| Phase | The implicit knowledge that is missing |
|---|---|
| Planning | what to build first, what the smallest useful slice is, how to break a huge idea into shippable pieces, when an idea is too big and must be split, what "scope" is and why scope creep kills projects |
| Design | the architecture forks (where data lives, who can access it, behaviour under many users) and the cheap-now-expensive-later traps |
| Testing | why test at all, what is worth testing, when, and the difference between "it worked once when I tried it" and "it reliably works" |
| Risk | what can go wrong (data loss, cost blowout, breaking at scale) and whether failure is graceful or catastrophic |
| Done | what "done" means, and how you know it actually works versus it looking like it works |
| Process | why small increments beat one big build, and the cost of changing direction late instead of early |

### Two worked translations (the operator's own examples)

**Testing.** The question he cannot answer: "What coverage do we need on the
image-upload endpoint?" The version he answers instantly: "Six months from now
someone uploads a 4 GB file, or two people upload at the same second. Do you
want the tool to (a) catch it and tell them clearly, (b) fail and you find out
later, or (c) not care, it is a throwaway script? Your answer decides what I
test and how hard." He does not need to know what a test is. He needs to know
how much it matters when it breaks. That, he knows cold.

**Sequencing ("scrum / what to build when").** He does not need the word scrum.
He needs: "We build the smallest version that does one real thing end to end.
For your image tool that is maybe 'upload one image and see it in a list.' Get
that fully working, then add tagging, then search. Each step is something you
can open and use." That is the entire method in his terms.

---

## Agent-structure analysis: do we have the right shape, or need another?

The maintainer asked this directly. Answer, grounded in the actual chain
(coordinator dispatch table, story-writer, spec-writer, researcher, OPERATOR.md):

### What exists

Issue (Feature/Bug/Tweak) -> researcher (codebase decode, read-only) ->
story-writer (gate 1) -> spec-writer (gate 2) -> builder -> validator ->
pr-shepherd. One Issue in, one PR out. Three gates. The coordinator is the
single entry point that routes each step and posts the operator-visible comment.

### What is missing: a transcription layer above the chain

The chain translates one instruction (mRNA) into one product (protein). It has
no stage that turns a whole idea (the gene) into the set of instructions
(mRNAs) in the first place. In biology that is transcription, upstream of
translation entirely. Ribosome has a ribosome and no polymerase.

This is the gap OPERATOR.md already named ("bad at deciding whether the plan is
the right plan"). For a non-coder with huge ideas, this missing layer is not a
nicety; it is the on-ramp. Without it the chain is unreachable, because he
cannot produce the well-formed Issue the chain starts from.

Proposed new role: a **planner** (working filename `planner.md` or
`decomposer.md`; functional, not metaphorical, per the naming rule). Biology
analogue documented as RNA polymerase plus splicing: reads the whole idea,
emits the discrete, sequenced Issues the chain will each translate. It runs as
a skill the coordinator invokes on a new trigger, symmetric to how story-writer
is a skill the coordinator runs on a feature Issue.

How it fits the operator's GitHub-only surface:

- The operator opens a "project" or "big idea" Issue (template question below).
- The planner holds a decomposition conversation in the Issue comments: the
  operator describes the idea, the planner proposes a breakdown (sequenced
  slices, the what and when and why, in plain language, with the domain
  decisions triaged and translated per the principle above), the operator
  refines with `/changes`.
- On approval, the planner emits the child Feature Issues, each of which feeds
  the existing chain unchanged. The "project" Issue becomes a roadmap that
  tracks them.

### This resolves the "two researchers" question cleanly

Earlier in the conversation the candidate was to split the researcher into a
codebase-decoder and an idea-decoder. The right resolution is not sideways but
upward: the idea-level work belongs in the planner, above the chain, not as a
second researcher beside the first. The researcher stays exactly as it is, a
pure codebase decoder. The instinct that there were two jobs was correct; the
second job is a different altitude, not a sibling.

### The interpreter is a skill, not an agent

The triage-and-translate function (the principle above) is tempting to build as
a dedicated "interpreter" agent that renders every gate. Recommendation: do not.

- The triage decision ("does this need the operator?") is best made by the
  producer that has the reasoning. The spec-writer knows why it chose an
  approach; an interpreter agent handed a finished spec would have to re-derive
  the triage without that context, and would mis-triage. This is the rule-3
  test failing: a separate context window here loses information rather than
  isolating noise.
- The shared concern is the voice and protocol, not the decision. The project's
  mechanism for shared conventions is a skill (verify-contracts documents
  conventions multiple agents follow). So: a new **coaching skill** (working
  name `operator-translation`) documents the protocol (the triage test, the
  three buckets, translate-to-consequence, default-to-autonomy), and the
  producers reference it.

Honest counter-argument for a dedicated interpreter agent: a single consistent
operator voice across every gate, and clean separation of "do the engineering"
from "talk to the human." If the producers' translations drift in tone or
rigour, revisit this. For now, rule 1 (skill before agent) and the information
argument both favour the skill.

### Enrich the two gate producers; keep researcher and the rest as-is

- **story-writer** triages requirements-level decisions: surfaces the
  domain-dependent ones, translated, under open questions; does not surface what
  it can safely assume.
- **spec-writer** triages engineering decisions: makes the pure-engineering ones
  autonomously (default to autonomy), surfaces only the domain-dependent ones
  translated to consequence at gate 2, and adds an explicit inform-only section
  for borderline assumptions. The existing "single most important sentence"
  red-flag mechanism is the seed of this.
- **researcher, builder, validator, pr-shepherd**: unchanged by this goal.

---

## Proposed structure, in one table

| Change | Type | New or existing | Why |
|---|---|---|---|
| `planner` (transcription layer) | skill the coordinator runs | new | turns an idea into sequenced Issues; the missing on-ramp |
| `operator-translation` (coaching protocol) | skill, referenced by producers | new | the triage line, three buckets, translate-to-consequence, default-to-autonomy |
| story-writer triage-and-translate | behaviour | enrich existing | makes gate 1 a real decision |
| spec-writer triage-and-translate plus inform-only | behaviour | enrich existing | makes gate 2 a real decision |
| researcher | none | unchanged | stays a pure codebase decoder |

---

## Slices, and the recommended first one

Dependency direction matters. The coaching protocol is the primitive that both
the existing gates and the future planner depend on; the planner should itself
talk to the operator using it. So build the primitive first.

1. **Slice 1 (BUILT, session 5): the coaching protocol plus spec-writer
   gate-2 enrichment.** Smallest, safest, touches no operator contract, reachable
   today because the chain already works for well-formed Issues. Proves
   translate-to-consequence and the three buckets on the existing surface, and
   immediately turns gate 2 from a rubber-stamp into a real decision. This
   revises the earlier in-conversation lean toward building decomposition
   first; the reason is the dependency direction (the planner needs the
   protocol, not the other way around).
2. **Slice 2: the planner / decomposition layer.** Bigger, and it touches the
   operator contract (see open decisions). Build it on top of the protocol from
   slice 1.
3. **Slice 3: story-writer enrichment and inform-only polish across gates.**

Each slice is gated and eval-guarded (new structural invariants for the new
prompts; see "Downstream" below).

### Slice 1 build definition (committed)

What to build:

- A new skill `.claude/skills/operator-translation/SKILL.md` documenting the
  protocol: the triage test, the three buckets (Ask / Decide / Inform-only),
  the translate-to-consequence technique with worked examples, and the two
  named guardrails (anti-rubber-stamp, default-to-autonomy). It is reference
  documentation a producer reads, in the same spirit as verify-contracts.
- An enrichment of `.claude/skills/spec-writer/SKILL.md` that references the new
  skill and changes its behaviour: triage each engineering decision into the
  three buckets; surface only domain-dependent decisions at gate 2, each
  translated to a consequence the operator can judge; add an "Assumptions
  (inform-only)" section for defaulted decisions that lean on something the
  operator said; keep pure-engineering decisions out of the operator's view.

Acceptance:

- The new skill file exists with name and description frontmatter.
- spec-writer's template gains an inform-only section and its body contains the
  triage three-bucket protocol (a candidate new structural eval invariant).
- `npm run typecheck`, `npm test`, and `npm run eval` stay green; any eval
  invariant whose count changed (for example a skill-count check) is updated
  deliberately, not reshaped.
- No new agent is added. No change to builder, validator, pr-shepherd, or
  researcher.

Out of scope for slice 1: the planner, the Project template, story-writer
enrichment. Those are slices 2 and 3.

---

## Decisions (settled session 5, maintainer)

1. **Coaching: skill, not a dedicated interpreter agent.** Settled per the
   information argument above. The coaching layer is a skill the producers
   reference. This goal introduces no new agents.
2. **Planner trigger: a new "Project" Issue template.** A deliberate, documented
   addition to the operator contract (OPERATOR.md moves from three templates to
   four). Explicit is kinder than guessing whether a Feature is secretly a
   project. Applies to slice 2.
3. **Decomposition approval: framed as a higher-altitude story gate, not a
   fourth gate.** This decision did not depend on operator domain knowledge (it
   turns on the three-gates convention), so per this goal's own triage test the
   maintainer delegated it. Recorded inform-only; veto available.
4. **Child Issue creation: the planner proposes, and creates the child Issues
   only after the decomposition gate is approved.** The guardrail half (the bot
   gains a narrow `gh issue create` privilege, used only post-approval) is an
   engineering call; the convenience half (auto-file after approval) was
   delegated. Applies to slice 2.
5. **Planner: a skill the coordinator runs (like story-writer), not a
   subagent.** Consistent with "no new agents." It may delegate heavy idea
   decode to a sub-call if needed. Applies to slice 2.
6. **Slice order: coaching first.** The coaching protocol is the primitive both
   the gates and the planner depend on; building it first means the planner
   talks to the operator well from day one.

The "agent or skill" question is therefore settled across the board: skills.
The chain gains no new agent under this goal.

---

## What not to do (guardrails to preserve)

- Do not let the producers slide from surfacing a decision to recommending an
  answer the operator cannot evaluate. Surface the fork and its consequences;
  the choice is his or, for engineering-only decisions, the agent's. A
  recommendation he cannot judge is a rubber-stamp wearing a suit.
- Do not narrow the autonomy zone to only what the operator can verify. That is
  the cage failure. Default to autonomy; gate only on domain knowledge.
- Do not add operator surface beyond what a slice needs. OPERATOR.md is the
  contract: plain language, few commands, few templates. Any new template or
  command is a deliberate, documented contract change, not a convenience.
- Do not touch builder, validator, pr-shepherd, or researcher internals under
  this goal without a separate brief. The chain-internals rule still holds.

---

## Downstream (not part of the vision, but real work the slices imply)

- New structural eval invariants for any new or changed prompt (for example:
  "spec-writer prompt contains the triage three-bucket protocol", "story-writer
  references the coaching skill"). Adding invariants is fine; reshaping the
  runner is not.
- This is also exactly the kind of behaviour the behavioural eval mode
  (goals direction, ~$5-9 per chain run on API or subscription quota on OAuth)
  would verify and structural eval cannot: that the spec-writer actually
  translates rather than just having the words in its prompt.

---

## Provenance

Conversation with the maintainer, session 5, 2026-05-29. The maintainer's two
load-bearing contributions: (1) the operator will rubber-stamp any
recommendation he cannot evaluate, and (2) the design must not cage the agent's
reasoning and creativity by routing engineering decisions through him. The
synthesis (triage line, three buckets, two named guardrails) follows from
holding both at once.
