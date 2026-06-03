### 2026-06-03 - Cleared four scout-filed doc-drift tweaks (#28-31)

Maintainer-direct fixes for the four trivial doc/config drifts the scouts filed
(the dep bump #27 still goes through the chain per the deps rule):

- **#28** registered `dream:decay` in `package.json` (the command was documented
  in CLAUDE.md but missing; `scripts/dream-decay.ts` already existed).
- **#29** README named Opus 4.7 in two places; the workflow uses
  `claude-opus-4-8`. Corrected both.
- **#30** README intro and "Deferred" section described Phases 4-6 as future;
  all phases have shipped. Rewrote to reflect that, keeping Playwright
  screenshots as the one genuinely-deferred item (now tracked by project #34).
- **#31** OPERATOR.md gate 3 promised "screenshots of every screen that
  changed"; the chain ships text-only PRs. Replaced with the accurate "validator
  report and a plain-language summary".

No code change; 92 unit tests and eval 55/55 unaffected.
