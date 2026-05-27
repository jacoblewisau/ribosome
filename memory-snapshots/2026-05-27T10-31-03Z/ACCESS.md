# Per-agent memory access matrix

Decided in PLAN.md §10. Enforced at session creation by which memory stores
are mounted, and at which access level. No agent writes to distilled. Only
the Dreaming job writes to distilled. That invariant is what makes distilled
trustworthy as a long-term store.

| Agent           | live (read) | live (write)                  | distilled (read)                | distilled (write) |
|-----------------|-------------|-------------------------------|---------------------------------|-------------------|
| researcher      | yes         | no                            | yes                             | no                |
| builder         | yes         | yes (in-flight notes only)    | yes                             | no                |
| test-author     | yes         | no                            | yes (patterns and traps)        | no                |
| validator       | yes         | yes (its report)              | yes (anti-patterns and traps)   | no                |
| pr-shepherd     | yes         | no                            | yes (operator preferences only) | no                |
| Dreaming job    | not applicable | not applicable             | yes (consumes last)             | yes (only writer) |

## Notes

- Live store is small and short-lived. It is mounted at session creation and
  dies with the session unless Dreaming picks it up.
- Distilled store is read-mostly during sessions. Items carry a confidence
  score and a reference count incremented every time they are read.
- The promotion pipeline distilled to MEMORY.md to CLAUDE.md keeps the
  global prompt from bloating. Only load-bearing items earn their way up.

This file is documentation of intent. Phase 2.5 wires the live store and
Phase 4.5 wires distilled and Dreaming. Phase 6 adds enforcement for the
"no writes to distilled outside Dreaming" invariant.
