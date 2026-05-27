# tests/verify

The contract harness for Ribosome. Borrowed from `how-we-claude-code` phase 3.

Every component, API route, or job declares a contract alongside its code in
a `*.contract.test.ts` file. A contract declares three things:

1. **Fixtures.** Canonical example inputs.
2. **Invariants.** Assertions that must hold across all fixtures.
3. **DOM / response contract.** The set of machine-readable selectors that
   the validator reads against. For UI, `data-contract` attributes on the
   relevant DOM nodes. For APIs, a typed response schema.

`npm run verify` invokes Vitest in JSON reporter mode against all
`*.contract.test.ts` files and writes the report to
`tests/verify/last-run.json`. The validator reads that JSON, not the source.

This directory holds shared harness code (none yet, single component) and the
JSON output file. The actual contracts live next to the code they describe.
