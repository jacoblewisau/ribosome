# data-verify-* attributes are the validator's surface, not the source

- **id**: `pat-data-verify-contract-surface`
- **category**: pattern
- **confidence**: 0.95
- **first seen**: 2026-05-27T23:51:42.683Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - src/verify/core/contract.ts
  - chain:0001
  - chain:0002
  - chain:0003
  - CLAUDE.md rule 13

Every observable element in this codebase exposes data-verify-* attributes via verifyAttrs(unit, state). The validator reads these attributes (and the tests/verify/last-run.json domSnapshot derived from them); it does not read the component source. Renaming or removing a data-verify-* attribute without updating every verify spec that mounts the unit is a breaking change. See CLAUDE.md rule 13 for the importer-in-scope corollary. The Phase 2 acceptance test demonstrated this: commenting out the `total` key in TodoApp's verifyAttrs surfaced three FAIL verdicts with domSnapshot.total absent on each.
