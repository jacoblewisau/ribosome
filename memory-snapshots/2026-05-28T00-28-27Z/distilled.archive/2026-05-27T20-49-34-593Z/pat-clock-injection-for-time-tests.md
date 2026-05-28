# Time-dependent components accept now?: () => number and resolve once per render

- **id**: `pat-clock-injection-for-time-tests`
- **category**: pattern
- **confidence**: 0.90
- **first seen**: 2026-05-27T20:49:34.593Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - chain:0003
  - src/features/todos/TodoApp.tsx
  - src/verify/specs/TodoApp.verify.ts

When a component derives observable state from the current time (overdue, expired, stale), it accepts an optional now?: () => number prop with default () => Date.now(). The prop is resolved once per render and the resulting nowMs is threaded to children. Contract fixtures inject a fixed clock (typically FIXED_NOW = Date.UTC(2026, 4, 15)) so verdicts are reproducible without timer mocking. See TodoApp.tsx for the canonical shape and TodoApp.verify.ts for the FIXED_NOW pattern.
