# OPERATOR.md — Using Ribosome

You do not need to write code. You do not need to open a terminal. Everything
you do happens inside GitHub: you open an Issue, you comment a couple of
times, and you merge a pull request when it is ready. This page is the
whole manual.

## How to start work

Open a new Issue in this repository and pick one of three templates.

- **Feature.** You want something new. Fill in: who is it for, what should
  happen, why it matters, and what success looks like. Plain English.
- **Bug.** Something is broken. Fill in: what happened, what should have
  happened, the steps to reproduce if you know them, and a screenshot or
  link if you have one.
- **Tweak.** Small wording, colour, or copy change. One line is enough.

You never have to pick a tech stack, a priority, or a label. Submitting
the Issue is the start signal.

## What happens after you submit

Within a minute, the bot posts a comment that says it has started reading
the codebase. From that point, the run pauses for you at three moments
called gates. At every other moment, the bot is working on its own and
you can close the tab.

### Gate 1: approve the story

The bot turns your Issue into a one-paragraph user story with a short list
of things that have to be true for the story to count as done. It also
lists what is explicitly out of scope and any genuine open questions.

You read it. If it captures what you wanted, reply `/approve`. If it does
not, reply `/changes` and a short sentence about what to change. The bot
rewrites the story and asks again.

This is the most important gate. Wrong assumptions caught here cost
nothing. Wrong assumptions caught later cost time.

### Gate 2: approve the spec

The bot turns the approved story into a technical brief: which files will
change, how the data flows, what tests will exist. You do not need to
understand every detail.

The bot does not just hand you a finished brief. It pulls out the few
decisions that genuinely need you, each written as a plain-language choice
with what each option costs you, and asks them before finalising. Answer in
plain English with `/changes`. It folds your answers in, asks follow-ups if
something was unclear, and reads back what it understood you want. When that
matches, reply `/approve`.

Decisions the bot can safely make on its own, it just makes; you never see
them. Decisions it assumed from something you said, it lists one line each so
you can wave them through or veto them. Skim for anything that looks wrong on
first read. Things worth flagging even if you do not code: storing personal
data in a new place, sending email from a new address, or any third-party
service you do not recognise.

### Gate 3: merge the PR

The bot writes the code, writes the tests, runs them, and opens a draft
pull request linked to your Issue. The PR contains screenshots of every
screen that changed, the validator report (any concerns grouped by
severity), and a plain-language summary of what changed.

If the validator report has anything labelled Critical, do not merge yet;
the bot will fix it and update the PR. If the PR is clean, click the green
Merge button.

That is the entire flow.

## The six commands

These are the only commands you ever type. They go in an Issue comment or
a PR comment.

| Command | What it does |
|---|---|
| `/approve` | Advance to the next stage. Use at gates 1 and 2. |
| `/changes <one sentence>` | Send the current draft back with your note. The bot rewrites and asks again. |
| `/cancel` | Stop the run and close the Issue. Safe to use any time. |
| `/explain <question>` | Ask the bot a question about the codebase. The bot replies in a comment, the run does not advance. Useful at gate 2 if something is unclear. |
| `/keep` | Used only on the weekly digest Issue. Confirms a memory item the bot wants to keep. |
| `/forget` | Used only on the weekly digest Issue. Tells the bot to drop a memory item. |

## The weekly digest

Once a week the bot opens an Issue titled "weekly digest" listing things it
has learned from recent runs in plain language. Each item has a `/keep`
or `/forget` button (well, a comment you reply with). If you do not reply
within seven days, the bot keeps the item by default.

This is how the bot gets better at your codebase over time. You do not
have to read every digest, but skimming once a week tightens the loop.

## When the bot proposes a rule change

Every so often, the bot will open a small pull request that only edits a
file called `CLAUDE.md`. That file is the bot's permanent memory of how
your codebase works. The PR will say in plain language what the new rule
is and why it is being proposed. Read it; if the rule sounds right, merge
it. If not, close the PR with a comment and the bot will not propose it
again.

## When to stop and ask a human

The bot is good at carrying out approved plans. It is bad at deciding
whether the plan is the right plan. Ask a human (the maintainer of this
repo) when:

- The bot has asked the same question twice and you are not sure.
- You see a PR that is much larger than the Issue suggested it would be.
- The validator report has a Critical item that the bot has not fixed
  after two attempts.
- You are about to merge something that touches authentication, payments,
  or anything else that could lose data or money if wrong.

There is no penalty for stopping. `/cancel` is always available.

## Saving a record of what the bot did

The bot keeps notes about each chain run in a folder called
`.claude/memory/`. By default these notes are local: they stay on the
maintainer's machine and never enter the repository's history. This
keeps git history quiet and avoids cluttering commits with byproducts.

When something happens that you want a permanent record of (an
important feature run, a postmortem, the state of memory before a big
change), the maintainer can run a single command:

```
npm run memory:snapshot
```

That command copies the current memory contents into a folder named
`memory-snapshots/<timestamp>/` and commits the copy. The original
memory keeps changing freely after that; the snapshot is frozen at
the moment of the command. You do not normally need to run this; the
maintainer will.

If you ever want to inspect what happened during a specific feature
run without reading code, ask the maintainer to run:

```
npm run chain:list           # show every feature the bot has worked on
npm run chain:show 0003      # detailed timeline for one feature
```

The output is plain text and tells you which gates were approved,
whether the validator returned clean, and how many lines each role
produced. This is the chain audit trail; you can always ask for it.

## What the bot will never do

- Push directly to the main branch.
- Merge a pull request on its own.
- Close an Issue you opened, unless you said `/cancel`.
- Add a new third-party service or send email from a new address without a
  spec change you approved.
- Commit secrets, API keys, or credentials. The pre-commit hook blocks
  these even if the bot tries.

If any of these happen, the bot has a bug. Tell the maintainer.
