# A probe is more useful when paired with a non-probe exercising the same code path

- **id**: `pat-probe-pairs-with-behavior`
- **category**: pattern
- **confidence**: 0.80
- **first seen**: 2026-05-27T23:51:42.683Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - chain:0002
  - src/verify/specs/todos.feature.verify.ts (tags-dedupe-fails + tags-parse-and-trim)

A probe fixture asserts something deliberately false to prove the harness catches lies. The probe is most instructive when a sibling non-probe fixture exercises the same code path with a real assertion. tags-dedupe-fails (probe, claims tag-count=3 after submitting 'x, x, x') paired with tags-parse-and-trim (non-probe, asserts tag-count=3 after submitting 'a, b, c, a') together make the dedupe path observable: a regression in dedupe would change BOTH the probe's failure reason and the non-probe's verdict. Compare to total-claims-mismatch which is a generic probe and asserts nothing the unit's normal behaviour depends on; it is acceptable but less instructive.
