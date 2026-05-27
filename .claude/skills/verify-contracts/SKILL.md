---
name: verify-contracts
description: Runs the contract harness, emits a canonical JSON report at tests/verify/last-run.json. The validator depends on this output. This skill also documents how a contract is authored and what a "broken contract" looks like.
---

You are running the verify-contracts skill in Ribosome. Two responsibilities:

1. Run `npm run verify`. Confirm exit 0 and the JSON report at `tests/verify/last-run.json` is fresh and well-formed.
2. When authoring or modifying contracts, follow the conventions below. The validator's behaviour is undefined for contracts that violate them.

## How to invoke

```
npm run verify
```

Runs Vitest against `src/verify/matrix.test.ts` with happy-dom. The matrix iterates every registered VerifiableUnit, runs every Fixture through every Verifier, and writes the canonical report to `tests/verify/last-run.json` from an `afterAll` hook. Vitest's own stdout shows test pass/fail in human-readable form; the JSON file is the validator's surface.

## Canonical report schema (version 1)

This shape is the contract between the verify-contracts skill and the `validator` subagent. Increment the `version` field if any field name or semantic changes. The validator's prompt cites the version it understands.

```json
{
  "version": "1",
  "generated_at": "ISO-8601 timestamp",
  "schema": "ribosome.verify.report",
  "totals": {
    "units": <number of distinct unitIds>,
    "fixtures": <total fixture runs>,
    "pass": <count of verdict==PASS and probe==false>,
    "fail": <count of verdict==FAIL>,
    "blocked": <count of verdict==BLOCKED>,
    "skip": <count of verdict==SKIP>,
    "probes": <count of probe==true (regardless of verdict)>
  },
  "results": [FixtureResult, ...]
}
```

`FixtureResult`:

```json
{
  "unitId": "the unit's registered name",
  "fixtureId": "the fixture's name",
  "probe": false,
  "verdict": "PASS" | "FAIL" | "BLOCKED" | "SKIP",
  "blockedReason": "only present when verdict==BLOCKED",
  "durationMs": 12.3,
  "timestamp": "ISO-8601",
  "checks": [Check, ...],
  "domSnapshot": { "<attr-name without data-verify- prefix>": "<value>", ... }
}
```

`Check`:

```json
{
  "verifier": "schema" | "invariants" | "dom-contract" | "a11y" | "runner",
  "status": "ok" | "fail" | "warn" | "probe",
  "reason": "human-readable failure description (present on fail / probe / warn)",
  "detail": <any structured payload the verifier wants to expose>
}
```

## What the validator does with this

The validator reads `tests/verify/last-run.json` and reasons as follows:

- Any `FixtureResult` with `verdict: "FAIL"` and `probe: false` is a **Critical** validator finding. The validator quotes `unitId`, `fixtureId`, and the failing `checks[].reason`.
- Any `FixtureResult` with `verdict: "BLOCKED"` is a **Critical** finding citing the `blockedReason`.
- Probe fixtures (`probe: true`) always have `verdict: "PASS"`. Inside their `checks` array, statuses of `probe` are expected. The validator does NOT treat these as findings.
- `domSnapshot` is the validator's source of truth for what the unit is showing. The validator compares the snapshot against the spec's expectations; mismatches are findings.

If the JSON is missing or has a version other than `"1"`, the validator refuses to run and reports BLOCKED at the chain level (the verify-contracts skill is broken).

## Authoring a contract

A contract lives at `src/verify/specs/<UnitName>.verify.ts` (one file per unit). Three things every contract declares:

### 1. Fixtures

A named, reproducible render configuration. Optionally drives interaction after mount via `act(container)`.

```typescript
{
  name: "with-tags-on-some-items",
  props: {},
  render: () => React.createElement(TodoApp, { now: () => FIXED_NOW }),
  act: async (container) => { /* fireEvent.click(...), etc. */ },
  invariants: [
    (dom) => dom.querySelector('[data-verify-unit="TodoApp"]')?.getAttribute("data-verify-total") === "3"
       || "expected total=3",
  ],
}
```

Fixtures that touch time MUST inject a fixed clock so the verdict is reproducible. See `src/verify/specs/TodoApp.verify.ts` for the `makeClock()` pattern.

### 2. Invariants

Predicates returning `true` (ok) or `false`/`string` (fail with reason). Each invariant tests one observable property of the mounted DOM.

A good invariant references the DOM contract surface, not internal React state. Compare:

- Good: `dom.querySelector('[data-verify-unit="TodoApp"]')?.getAttribute("data-verify-total") === "3"`
- Bad: any assertion about React internals or component instance state.

### 3. DOM contract

Every component emits `data-verify-*` attributes via `verifyAttrs(unitName, state)` from `src/verify/core/contract.ts`. The root element of the unit carries `data-verify-unit="<UnitName>"`; observable state is exposed as `data-verify-<key>="<value>"` on the same root.

The DOM contract is the validator's surface. Renaming or removing a `data-verify-*` attribute is a breaking change; do not do it without updating the contract specs that depend on it (per CLAUDE.md rule 13).

## Probes are required, not optional

Every registered unit MUST declare at least one fixture with `probe: true`. The matrix asserts this; a unit with zero probes blocks the matrix run.

A probe is an adversarial fixture: the invariant deliberately asserts something the unit's normal behaviour will violate, so the verifier records a `probe`-status check. The probe's `verdict` is always `PASS` (because we expect the assertion to fail); the existence of the probe-status check inside `checks` is what proves the harness can catch lies.

A useful probe asserts something orthogonal-but-related to the unit's stated behaviour, so a future code change that breaks the unit's core path visibly changes the probe's reason. Examples in the repo:

- `TodoApp/total-claims-mismatch`: submits three todos, asserts total=999. Catches the dom-contract verifier wiring.
- `TodoStats/inconsistent-counts`: renders with total != done + active. Catches the counts-add-up invariant.
- `todos.feature/tags-dedupe-fails`: submits "x, x, x", asserts tag-count=3 (parser dedupes to 1). Catches the dedupe path.
- `TodoApp/claims-future-date-is-overdue`: submits future-dated todo, asserts overdue=true. Catches the isOverdue helper.

A probe that asserts a generic falsehood (`total=999`) is acceptable. A probe that asserts something specific to the unit's contract (`claims-future-date-is-overdue`) is better because it makes the probe instructive.

## How a "broken contract" surfaces

Common breakage shapes the validator reads from the JSON:

| Breakage | What appears in JSON |
|---|---|
| Component drops a required `data-verify-*` attribute | `domSnapshot` is missing the key; `dom-contract` check stays `ok` but `invariants` referencing the attribute fail with a specific reason |
| Component renames a `data-verify-unit` value | `dom-contract` verifier check `fail` with reason `missing data-verify-unit="UnitName" element` |
| Invariant predicate threw | `invariants` check `fail` with reason `invariant[i] threw: <error>` |
| Render itself threw | Single check from `runner` with status `fail`; verdict `BLOCKED`; `blockedReason` populated |
| New unit added without a probe | Matrix's first assertion fails (`unit "X" has no probe fixture`); npm run verify exits non-zero before producing the JSON |
| Schema (Zod) mismatch on fixture.props | `schema` check `fail` with reason `props failed Zod schema` and `detail` containing the Zod issues |

When the validator reports a fail, the corrective action is: edit the fixture or the unit until `verdict==PASS` returns; do not edit the harness.

## What you do not do

- You do not interpret the JSON for the validator. Your job ends at producing it.
- You do not modify CLAUDE.md or any agent file.
- You do not delete a fixture or a probe to "make the matrix green"; that defeats the purpose. If a fixture is genuinely wrong, fix the assertion; if the fixture is testing something out of scope, surface as a blocker to the operator.
- You do not invent new verifiers (schema, invariants, dom-contract, a11y). Adding a verifier is a Phase 2+ design decision that requires updating this skill, the JSON schema version, and the validator prompt.

## Divergences from `cwc-workshops/how-we-claude-code/phase-3-verify`

For anyone reading the workshop and comparing:

- Workshop uses a separate `Invariant` type registered on the unit plus optional `onlyFixtures` restriction; Ribosome inlines invariants on each fixture. Simpler, less general, sufficient at current scale.
- Workshop's matrix-test names include the probe emoji (`🔍`); Ribosome forbids emoji globally per CLAUDE.md prose rules.
- Workshop exposes `window.__verify` as a runtime agent handle for live observation; Ribosome relies on the JSON file alone. Adding a live handle is a Phase 3+ deliverable for Playwright screenshots.
- Workshop verdict logic treats "no verifiers registered" or "no container" as BLOCKED; Ribosome's runner agrees and additionally treats `verifier.run` throwing as BLOCKED via the runner-tagged check.

These divergences are deliberate; the workshop's published convention is the source of truth where Ribosome borrows. Changes to align further are welcome via a spec; do not silently drift.
