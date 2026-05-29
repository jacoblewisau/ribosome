# Goal — package Ribosome as a Claude Code plugin (draft + split decision)

**Status:** draft for the maintainer to review. No files have been restructured; the manifests below are proposals, not placed in the repo. The architectural decision (what the plugin is actually for) is yours.
**Authored:** 2026-05-29, session 4.
**Driver:** session-1 and session-3 handoffs both listed "package Ribosome as a Claude Code plugin" as open work, for a `plugin_marketplaces` install path so other repos can adopt Ribosome. Before drafting, the current plugin spec was verified from primary source.

Primary references (fetched live 2026-05-29 via the claude-code-guide agent; not training-data recall):
- Plugins reference: `https://code.claude.com/docs/en/plugins-reference.md`
- Create plugins: `https://code.claude.com/docs/en/plugins.md`
- Plugin marketplaces: `https://code.claude.com/docs/en/plugin-marketplaces.md`
- Discover and install: `https://code.claude.com/docs/en/discover-plugins.md`

---

## The finding that should drive the decision

A plugin can carry skills, slash commands, subagents, hooks, MCP servers, LSP servers, and bundled executables. A plugin **cannot** carry GitHub Actions workflows or any file outside its own directory: "Installed plugins cannot reference files outside their directory" (plugins-reference.md, path-traversal limitations).

That matters because of where Ribosome's parts actually run:

| Ribosome component | Where it executes | Can a plugin deliver it? |
|---|---|---|
| `ribosome.yml` + 8 `scout-*.yml` | the target repo's GitHub Actions runner | No. Workflows must live in the target repo's `.github/workflows/`. |
| `.claude/agents/*` (researcher, builder, validator, pr-shepherd) | inside the Actions runner, via the action checking out the target repo | No benefit. The action uses the target repo's `.claude/`, not a maintainer's locally installed plugin. |
| `.claude/skills/*` chain + scout skills (coordinator, story-writer, spec-writer, the 7 scouts, dream) | same as above, in CI | No benefit, same reason. |
| `.claude/hooks/*` (block-secrets, enforce-scope, enforce-distilled-write) | in CI and on local commits in the target repo | No benefit for CI; would need the target repo's copy. |
| `/setup` skill + `setup-bootstrap.ts` + `setup-check.ts` + `slack.md` | the **maintainer's** local Claude Code, once, to bootstrap a repo | **Yes. This is the natural plugin.** |

So the chain (agents, scout skills, hooks, workflows) must be **materialized into each target repo** by the bootstrap, because it runs in that repo's CI against that repo's files. Installing the chain as a plugin in a maintainer's Claude Code session does nothing for CI. The one part that genuinely belongs in a plugin is the **maintainer-facing setup tooling**: a plugin lets a maintainer run `/plugin install ribosome@...` and then `/setup <repo>` from any session, with no `git clone` of Ribosome first.

## Recommended shape: a thin "ribosome-setup" plugin, not a whole-chain plugin

The plugin ships only the setup surface and carries the chain files as **payload assets** that `setup-bootstrap.ts` writes into the target repo (it already copies these files; the only change is reading them from `${CLAUDE_PLUGIN_ROOT}` instead of a relative checkout path).

Proposed plugin layout (NOT created; proposal only):

```
ribosome-setup/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── setup/
│       ├── SKILL.md            # the existing /setup skill body
│       └── slack.md
├── commands/                   # (optional) maintainer commands: chain:show, dream:show
├── scripts/
│   ├── setup-bootstrap.ts
│   └── setup-check.ts
└── assets/                     # the chain, shipped as data for bootstrap to copy
    ├── claude/                 # full .claude/ tree to drop into the target repo
    └── workflows/              # ribosome.yml + scout-*.yml to drop into target .github/workflows/
```

Draft `.claude-plugin/plugin.json` (only `name` is required per the spec; the rest is good hygiene):

```json
{
  "name": "ribosome-setup",
  "displayName": "Ribosome Setup",
  "version": "0.1.0",
  "description": "Bootstrap a GitHub repo into a Ribosome Issue-to-PR chain. Installs the /setup orchestrator; setup writes the chain and workflows into your repo.",
  "author": { "name": "Jacob Lewis" },
  "repository": "https://github.com/jacoblewisau/ribosome",
  "license": "MIT",
  "keywords": ["github", "automation", "issue-to-pr", "agents"]
}
```

Draft `.claude-plugin/marketplace.json` (could live in the same `jacoblewisau/ribosome` repo, or a dedicated marketplace repo):

```json
{
  "name": "ribosome",
  "owner": { "name": "Jacob Lewis" },
  "plugins": [
    {
      "name": "ribosome-setup",
      "source": { "source": "github", "repo": "jacoblewisau/ribosome" },
      "description": "Bootstrap a repo into a Ribosome Issue-to-PR chain.",
      "version": "0.1.0",
      "category": "productivity",
      "keywords": ["github", "automation"]
    }
  ]
}
```

Install path for a maintainer (verbatim from discover-plugins.md):

```
/plugin marketplace add jacoblewisau/ribosome
/plugin install ribosome-setup@ribosome
/setup --repo my-new-repo --visibility public --seed-issue
```

## Work this would require (estimate, for a future briefed session)

1. **Restructure into plugin layout** (the part explicitly out of scope today): move `.claude/skills/setup` and the setup scripts under a plugin root, and bundle the chain `.claude/` tree and the 9 workflow files under `assets/`. The live repo keeps its own `.claude/` and `.github/` for its own dogfooding; the plugin is a separate build artifact or a subdirectory with its own marketplace source path.
2. **Repoint `setup-bootstrap.ts`** to read the chain/workflow assets from `${CLAUDE_PLUGIN_ROOT}/assets/...` when run as an installed plugin, falling back to the relative repo paths when run from a Ribosome checkout. This is the one real code change.
3. **Hook path rewriting**: any hook the plugin itself registers must use `${CLAUDE_PLUGIN_ROOT}` (spec requirement). The chain hooks are payload (copied into the target repo), so they keep their target-repo-relative paths; only plugin-owned hooks, if any, need the variable.
4. **Decide marketplace home**: same repo (`source: github, repo: jacoblewisau/ribosome`) is simplest; a dedicated marketplace repo is cleaner if you later ship more than one plugin.

## Open questions for you

- Is the plugin worth building at all, or is `git clone + npm run setup` an acceptable maintainer path? The plugin's only real win is skipping the clone. If you expect other people (not just you) to stand up Ribosome repos, the plugin is worth it; if it is just you, the clone is fine.
- Single-repo plugin-plus-assets, or split the chain into its own template repo that `setup` clones? A GitHub template repo is an alternative to bundling assets in the plugin, and may be simpler than the asset-copy path.
- Naming: `ribosome-setup` (honest about what it does) vs `ribosome` (cleaner, but implies it installs the whole chain, which it does not).

## Recommendation

Build it only if adoption beyond you is a near-term goal. If so, the thin `ribosome-setup` shape above is the right one: it is the only part that benefits from being a plugin, and it sidesteps the workflows-cannot-ship-in-a-plugin constraint by treating the chain as copy-in payload (which the bootstrap already does). Do not attempt to ship the chain agents/skills as plugin components: CI uses the target repo's files, so it would be dead weight.
