---
name: dream
description: Consolidate chain artifacts into the distilled memory store. Reads every completed chain at .claude/memory/live/<id>/, the corrections log, and the latest verify report. Emits a new distilled store at .claude/memory/distilled/<timestamp>/ and regenerates the operator-facing MEMORY.md at the repo root. Runs manually for now; Phase 3's nightly cron will schedule it.
---

You are running the `dream` skill in Ribosome. Phase 4.5 substrate. Your job is to compress what Ribosome has learned across feature runs into a small set of durable, citable distilled items.

This skill replaces the managed-agents Dreaming API for the Claude Code substrate (per plan §10, the Dreams API consumes managed-agent transcripts and is the wrong shape for our chain artifacts).

## Inputs

Read all of the following before producing anything:

1. **Every chain on disk.** Use `npm run chain:list` to enumerate. For each chain id, read:
   - `.claude/memory/live/<id>/chain.json`
   - `.claude/memory/live/<id>/researcher.md`
   - `.claude/memory/live/<id>/builder.md`
   - `.claude/memory/live/<id>/validator.md`
   - The story at `stories/<id>.md` and spec at `specs/<id>.md`
   Only include chains where `chain.json` has `current_step: "completed"`.

2. **The corrections log** at `.claude/corrections.jsonl`. One JSON object per line; each line records an operator `/changes <note>` reply or a PR review comment that signalled a correction. May be empty.

3. **The latest verify report** at `tests/verify/last-run.json` (schema `ribosome.verify.report`, version `"1"`). The probe fixtures and any FAIL verdicts there are signal.

4. **The current latest distilled store** (if any). Use the helper:
   ```
   node --experimental-strip-types -e "import('./src/chain/distilled.ts').then(d => console.log(JSON.stringify(d.readLatestDistilled() ?? {}, null, 2)))"
   ```
   Or read `.claude/memory/distilled/<latest>/store.json` directly. If none exists, this is the first dream pass.

## What to produce

Build a new `DistilledStore` (schema in `src/chain/distilled.ts`) and write it via the helper. The categories and what belongs in each:

| Category | Examples |
|---|---|
| `pattern` | "in this repo, payment flows always go through `services/billing.ts`; do not introduce a second entry point." |
| `anti-pattern` | "feature 0001 builder tried to add `--passWithNoTests` directly; that earned CLAUDE.md rule 11. Do not edit `package.json` scripts without listing it in scope_paths." |
| `operator-preference` | "operator twice rejected solutions using library X for reason Y; prefer Z." |
| `domain-invariant` | "every query against `orders` must filter by `tenant_id`." |
| `eval-trap` | "task F2 hides an ambiguity in `as_a`; the correct move is to open a question, not guess." |

Item shape (TypeScript interface in `src/chain/distilled.ts`):

```typescript
interface DistilledItem {
  id: string;             // short, kebab-case, prefixed by category, e.g. "pat-scope-package-json"
  category: DistilledCategory;
  title: string;          // one line; what the item says
  body: string;           // ~200 words; the evidence and the rule
  evidence: string[];     // citations: ["chain:0001", "CLAUDE.md:11", "specs/0003.md"]
  confidence: number;     // 0..1; how universal is this rule
  reference_count: number;// preserve prior count if updating an existing item; 0 if new
  first_seen: string;     // preserve prior; ISO-8601 of first dream pass that distilled it
  last_referenced?: string;
}
```

## Synthesis rules

Be ruthless about quality. Better one accurate item than five mushy ones.

1. **Items must be actionable.** Each item should change what the next chain run does. If reading the item would not change behaviour, it does not belong.
2. **Cite evidence.** Every item must reference at least one chain id, file path, or commit. No items based on inference alone.
3. **Promote, do not duplicate.** If a rule already exists in CLAUDE.md, do not add it as a distilled item. The promotion path is distilled -> rule-miner PR -> CLAUDE.md; distilled is the staging area, CLAUDE.md is the permanent home.
4. **Carry forward citations.** If an item from the previous distilled store still applies, copy its id, first_seen, and reference_count. Only update the body when new evidence has accumulated. Drop items whose reference_count is 0 and that have not been cited in the last three dream passes (decay).
5. **Keep it small.** Phase 4.5 the store should typically contain 5 to 20 items. If you exceed 30, you are not being ruthless enough.
6. **Operator-preferences cite the operator's exact words** where possible. If you cannot quote the operator, the item is probably an inference; downgrade it.

## How to write the store

Use the helper:

```
node --experimental-strip-types -e "
import('./src/chain/distilled.ts').then(d => {
  d.writeDistilled({
    generated_at: new Date().toISOString(),
    source_chains: ['0001', '0002', '0003'],
    items: [
      {
        id: 'pat-...',
        category: 'pattern',
        title: '...',
        body: '...',
        evidence: ['chain:0001'],
        confidence: 0.9,
        reference_count: 0,
        first_seen: new Date().toISOString(),
      },
    ],
  });
});
"
```

For a small store (under 5 items) writing the JSON by hand is also acceptable; the helper handles archiving the previous store and regenerating the per-store `MEMORY.md` index and the repo-root `MEMORY.md` digest.

## What you do not do

- You do not modify CLAUDE.md. The rule-miner skill is the gate.
- You do not invent items. Every item has citations or it is not an item.
- You do not delete a previous item silently. To drop an item, use `npm run dream:forget <id>` so the action is auditable.
- You do not write anything outside `.claude/memory/distilled/<timestamp>/` and the repo-root `MEMORY.md`.
- You do not run if any chain on disk has `current_step` other than `"completed"`. A mid-run chain means the live store is still being written; dreaming over an incomplete state corrupts the distilled output.

## Operator interaction

The operator sees only the repo-root `MEMORY.md` (committed) and the weekly digest Issue (Phase 3+). They reply `/keep` or `/forget <id>` on the digest Issue. The `/forget` reply invokes `npm run dream:forget <id>` via the Phase 3 webhook. For Phase 4.5 alone, this is manual.

## Style

No en or em dashes. No emoji. Items are short, specific, evidence-citing. Body is markdown that reads cleanly inline in the operator's MEMORY.md.
