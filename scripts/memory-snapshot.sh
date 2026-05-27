#!/usr/bin/env bash
#
# memory-snapshot.sh
#
# Opt-in. Copies the current contents of .claude/memory/ into
# memory-snapshots/<ISO-timestamp>/ and stages + commits the copy.
#
# Why a copy rather than `git add -f .claude/memory`: forcing past the
# gitignore would track those files thereafter, making `git status`
# permanently noisy with memory churn. The snapshot pattern keeps the
# regular memory store gitignored (so live writes stay invisible to
# git) and the snapshot directory in git (so each commit is a tagged
# moment, immutable from then on).
#
# Invoke via `npm run memory:snapshot` or directly: ./scripts/memory-snapshot.sh
#
# A message can be passed as the first argument; defaults to an
# auto-generated message naming the live chains found.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MEMORY_DIR=".claude/memory"
if [ ! -d "$MEMORY_DIR" ]; then
  echo "memory-snapshot: $MEMORY_DIR does not exist" >&2
  exit 1
fi

# Empty check
if [ -z "$(find "$MEMORY_DIR" -mindepth 1 -not -name '.gitkeep' 2>/dev/null | head -1)" ]; then
  echo "memory-snapshot: nothing to snapshot (only .gitkeep files present)"
  exit 0
fi

TS="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
SNAPSHOT_DIR="memory-snapshots/$TS"

mkdir -p "$SNAPSHOT_DIR"
cp -R "$MEMORY_DIR"/. "$SNAPSHOT_DIR"/

# Manifest summarising what was snapshotted.
chains="$(find "$SNAPSHOT_DIR/live" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | xargs -n1 basename 2>/dev/null | sort | paste -sd, - || true)"
distilled_files="$(find "$SNAPSHOT_DIR/distilled" -mindepth 1 -type f 2>/dev/null | wc -l | tr -d ' ' || echo 0)"
distilled_archive_files="$(find "$SNAPSHOT_DIR/distilled.archive" -mindepth 1 -type f 2>/dev/null | wc -l | tr -d ' ' || echo 0)"

cat > "$SNAPSHOT_DIR/manifest.json" <<EOF
{
  "snapshot_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$MEMORY_DIR",
  "live_chains": "${chains:-}",
  "distilled_files": $distilled_files,
  "distilled_archive_files": $distilled_archive_files,
  "git_head_at_snapshot": "$(git rev-parse HEAD 2>/dev/null || echo none)"
}
EOF

echo "memory-snapshot: copied to $SNAPSHOT_DIR"
echo "  live chains:                 ${chains:-(none)}"
echo "  distilled files:             $distilled_files"
echo "  distilled.archive files:     $distilled_archive_files"
echo ""

# Stage just the snapshot directory by name.
git add "$SNAPSHOT_DIR"

if git diff --cached --quiet; then
  echo "memory-snapshot: snapshot produced no staged changes (already committed?)"
  rm -rf "$SNAPSHOT_DIR"
  rmdir memory-snapshots 2>/dev/null || true
  exit 0
fi

MSG="${1:-}"
if [ -z "$MSG" ]; then
  MSG="memory: snapshot $TS"
  if [ -n "$chains" ]; then
    MSG="$MSG (chains: $chains)"
  fi
fi

git commit -m "$MSG"$'\n\n'"Force-staged copy of .claude/memory/ into memory-snapshots/$TS/.
Regular memory state remains gitignored. To remove this snapshot:
  git revert HEAD
or
  rm -rf memory-snapshots/$TS && git add memory-snapshots && git commit -m 'memory: drop snapshot $TS'"

echo ""
echo "memory-snapshot: committed."
git log -1 --oneline
