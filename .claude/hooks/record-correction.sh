#!/usr/bin/env bash
#
# record-correction.sh
#
# Append a correction record to .claude/corrections.jsonl. Used by the
# coordinator's `/changes <note>` dispatch (Phase 3+) and by the
# operator's PR review comments (Phase 4+).
#
# Not a Claude Code hook (no PreToolUse / PostToolUse trigger). This
# is a plain CLI script invoked explicitly by the coordinator or by
# the workflow when a corrective signal is observed. Lives in
# .claude/hooks/ for adjacency with the other guards.
#
# Usage:
#   record-correction.sh <chain-id> <step> <note>
#
# Each invocation appends one JSON line of shape:
#   {"timestamp": "ISO-8601",
#    "chain_id": "0004",
#    "step": "spec-writer",
#    "note": "the operator's verbatim text",
#    "source": "github-issue-comment"|"pr-review"|"manual"}

set -uo pipefail

if [ "$#" -lt 3 ]; then
  printf 'usage: record-correction.sh <chain-id> <step> <note> [source]\n' >&2
  exit 2
fi

CHAIN_ID="$1"
STEP="$2"
NOTE="$3"
SOURCE="${4:-manual}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$REPO_ROOT/.claude/corrections.jsonl"

mkdir -p "$(dirname "$LOG")"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# jq -c -n produces one compact JSON object per call. Append a newline
# so the file remains line-delimited even when invoked rapidly.
jq -c -n \
  --arg ts "$TS" \
  --arg id "$CHAIN_ID" \
  --arg step "$STEP" \
  --arg note "$NOTE" \
  --arg source "$SOURCE" \
  '{timestamp: $ts, chain_id: $id, step: $step, note: $note, source: $source}' \
  >> "$LOG"

printf 'recorded correction for chain %s at step %s\n' "$CHAIN_ID" "$STEP"
