### 2026-08-17 - Chain 0008: README required-check names match checks.yml

The README branch-protection checklist told a maintainer to require five status
checks (`typecheck, lint, unit tests, acceptance tests, contract verify`), but
`.github/workflows/checks.yml` defines only three jobs whose `name:` values are
what GitHub matches on: `typecheck`, `test`, and `verify`. The four phantom
names would have blocked every PR permanently. Chain 0008 rewrote the one stale
line to require exactly the three real job names and added
`tests/acceptance/0008.spec.ts`, which cross-checks the README bullet against
the actual job names so the drift cannot recur.
