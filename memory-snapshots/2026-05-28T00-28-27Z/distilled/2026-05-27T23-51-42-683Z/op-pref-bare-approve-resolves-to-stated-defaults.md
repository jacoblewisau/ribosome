# Operator's bare /approve resolves story open questions to the stated defaults

- **id**: `op-pref-bare-approve-resolves-to-stated-defaults`
- **category**: operator-preference
- **confidence**: 0.85
- **first seen**: 2026-05-27T23:51:42.683Z
- **reference count**: 0
- **last referenced**: never
- **evidence**:
  - chain:0001
  - chain:0002
  - chain:0003
  - stories/0001.md
  - stories/0002.md
  - stories/0003.md

Story-writer surfaces genuine open questions and offers stated defaults ("above assumes X, Y, Z; operator confirms"). The operator's bare /approve, observed in all three chains (0001 reset button, 0002 tags, 0003 due dates), accepts the defaults as-is. /changes is reserved for cases where the operator wants a non-default answer. Implication for the story-writer: phrase defaults with confidence, not as questions; the operator approves the defaults explicitly when bare /approve is the path.
