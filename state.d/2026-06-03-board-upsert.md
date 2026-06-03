### 2026-06-03 - Mission Control board rebuild is one robust command (--upsert)

Found by the first live tweak run (#44 -> PR #45). The tweak fast-path itself
worked (it skipped the story and plan gates and opened the PR), but the run
exited `failure`: the board-rebuild epilogue used a shell `> file` redirect,
which Claude Code's Action sandbox blocks, and the agent thrashed retrying until
it hit `error_max_turns` (60). A latent second bug: the gather used four `gh
--label` flags, which are AND-ed, so it would have matched no chains.

Fix: a single deterministic command does the whole board rebuild.

- `scripts/mission-control.ts --upsert` gathers every open chain (and those
  closed in the last 7 days) via `gh` (`execFileSync`, no shell), parses each
  sticky marker, renders with the pure module, and edits or creates the
  `ribo:in-flight` Issue. No piping, no redirection, one agent turn. `--dry-run`
  prints the board read-only.
- New pure `parseStateMarker()` in `src/chain/mission-control.ts` (4 unit tests);
  the module stays I/O-free (TR17 still holds).
- Gather lists all issues and filters chain labels in-process (the `--label` AND
  bug).
- Coordinator and shepherd recipes collapsed to the one command; the workflow
  append-prompt points at `--upsert`.

Verified: 92 unit tests, eval 55/55, and `--upsert --dry-run` renders the real
repo board (7 needs-you, #44 "Ready to merge", #42 in Done this week).
