# Ribosome

Ribosome is a Claude Code workflow that turns a GitHub Issue into a merged
pull request through a coordinated chain of specialised subagents and
skills. It is built for a non coder operator (the GitHub UI is the whole
interface) and a proactive posture (background scouts open Issues for
failing tests, dependency rot, coverage gaps, and doc drift). The name is
from the molecular machine that reads an instruction (mRNA) and
synthesises a new working object (a protein). The design document is at
`/Users/jacobl/research/software-factory/PLAN.md`.

If you are the operator, read `OPERATOR.md` and stop there; it is the
whole manual and it is two pages long. If you are the maintainer, read
`CLAUDE.md` next for the architectural rules, then the plan. Current
phase is 0 (foundations); see `PLAN.md` §12 for the phase plan.

## Local setup

```
git clone <this repo>
cd ribosome
git config core.hooksPath .claude/hooks
```

The hook config is per-clone; setting it once after cloning wires the
pre-commit secrets guard. Verification is in `CLAUDE.md` under "Hook
installation".

## Branch protection (apply on first push)

Phase 0 ships locally. When this repo gets pushed to GitHub, apply the
following branch protection rules to `main` before the first PR is
opened. Each rule has a reason behind it.

- [ ] Require a pull request before merging to `main`. (Stops direct
      pushes that bypass the validator.)
- [ ] Require at least one approving review on every PR. (For Ribosome
      PRs, the operator is the reviewer; this enforces the third human
      gate.)
- [ ] Require status checks to pass before merging. Include at minimum:
      typecheck, lint, unit tests, acceptance tests, contract verify.
      (Phase 2 wires the checks; until then, this list is the contract.)
- [ ] Require conversation resolution before merging. (Forces the
      operator to acknowledge each validator finding.)
- [ ] Require linear history. (Merge conflicts surface as conflicts, not
      as silent rebases.)
- [ ] Block force pushes to `main`. (Non-negotiable. Ribosome never
      force pushes; this stops a human mistake too.)
- [ ] Block deletions of `main`. (Same reason.)
- [ ] Restrict who can push to `main` to: nobody directly. All changes
      go through PRs. (Includes the maintainer.)
- [ ] Require signed commits if the maintainer has signing set up.
      (Optional, but recommended once the repo holds real work.)
- [ ] Do not allow bypassing the above for any role, including admins.
      (The point of branch protection is that it is not bypassable in
      the heat of an incident.)

These are enforced in the GitHub UI under Settings > Branches > Branch
protection rules, or via the `gh api` once the repo is on GitHub.
