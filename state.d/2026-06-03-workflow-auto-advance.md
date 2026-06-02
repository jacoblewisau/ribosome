### 2026-06-03 - Workflow supports the bundle's auto-advance and tweak fast-path

Completion fix for the native-GitHub bundle. The coordinator skill knew the new
flow, but `.github/workflows/ribosome.yml` did not: its per-invocation system
prompt said "do exactly ONE chain step... advance by exactly one step then
STOP", which would stall both new behaviours (an auto-advanced spec and a
ribo:tweak both need to run through to the PR in one invocation, since no
operator event arrives to resume them). Found by inspection before spending a
live run.

- Rewrote the `--append-system-prompt` to "one gate transition per invocation":
  run through a gate that is skipped or auto-advanced (tweak, or auto-approved
  spec) to the draft PR; only stop at a pending human gate. Spells out the six
  cases and requires rebuilding the Mission Control board as the last action.
- Added `Bash(printf:*)` and `Bash(date:*)` to `--allowedTools` so the board
  rebuild (`printf ... | node scripts/mission-control.ts --updated "$(date ...)"`)
  is permitted in the Action.
