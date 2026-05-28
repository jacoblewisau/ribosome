# Matrix tests must use expect.soft or they hide downstream failures

- **id**: `ap-vitest-default-bails-at-first-fail`
- **category**: anti-pattern
- **confidence**: 0.90
- **first seen**: 2026-05-27T20:49:34.593Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - src/verify/matrix.test.ts
  - commit:632c439 (phase 2)

Vitest's default expect().toBe() throws synchronously and bails the rest of the test. For a matrix test that runs every fixture and writes a canonical report consumed by the validator, a default expect causes the report to contain only the first failing fixture; downstream failures are invisible. Use expect.soft for the verdict assertions inside the matrix loop, then a final expect to fail the test if any soft expect was violated. Discovered during the Phase 2 acceptance demonstration when deliberately omitting data-verify-total surfaced only TodoApp/empty initially.
