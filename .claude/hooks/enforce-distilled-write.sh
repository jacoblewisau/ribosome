#!/usr/bin/env bash
#
# enforce-distilled-write.sh
#
# PreToolUse hook for Write / Edit / MultiEdit. Phase 6 deliverable.
#
# Rejects writes to .claude/memory/distilled/** unless a dream pass is
# active. A dream pass is "active" when the marker file
# .claude/memory/.dream-active exists. The `dream` skill creates this
# marker at the start of a pass and removes it at the end; if the
# skill crashes mid-pass the marker can be removed manually.
#
# This is defense in depth, not adversarial security. The plan §10
# invariant says "No agent writes to distilled" and this hook makes
# that invariant mechanical. A bad-faith actor could create the
# marker themselves, but the chain's own subagents (researcher,
# builder, validator, etc.) cannot accidentally write to distilled.
#
# Contract:
#   stdin: JSON with tool_name, tool_input.file_path, cwd, ...
#   exit 0: allow
#   exit 2: block + stderr shown to Claude as feedback

set -uo pipefail

TOOL_JSON="$(cat)"

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$TOOL_JSON")"
TARGET_PATH="$(jq -r '.tool_input.file_path // empty' <<<"$TOOL_JSON")"
CWD="$(jq -r '.cwd // empty' <<<"$TOOL_JSON")"

case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

[ -z "$TARGET_PATH" ] && exit 0

REPO_ROOT="${CWD:-$(pwd)}"
DISTILLED_ROOT="$REPO_ROOT/.claude/memory/distilled"
MARKER="$REPO_ROOT/.claude/memory/.dream-active"

# Normalise target path.
case "$TARGET_PATH" in
  "$REPO_ROOT"/*) TARGET_REL="${TARGET_PATH#$REPO_ROOT/}" ;;
  /*)             TARGET_REL="$TARGET_PATH" ;;
  *)              TARGET_REL="$TARGET_PATH" ;;
esac

# Allow if not targeting the distilled tree.
case "$TARGET_REL" in
  .claude/memory/distilled/*) ;;
  *) exit 0 ;;
esac

# Targeting distilled. Allow only if the dream marker is present.
if [ -f "$MARKER" ]; then
  exit 0
fi

{
  printf 'enforce-distilled-write: write to "%s" rejected.\n' "$TARGET_REL"
  printf '\n'
  printf 'The distilled memory store at .claude/memory/distilled/ is the\n'
  printf 'output of the `dream` skill alone (plan §10 invariant: "No agent\n'
  printf 'writes to distilled; that is the invariant that keeps distilled\n'
  printf 'trustworthy"). To write to distilled, run the dream skill, which\n'
  printf 'creates .claude/memory/.dream-active before writing and removes it\n'
  printf 'after. The marker is currently absent.\n'
  printf '\n'
  printf 'If you are debugging the dream skill itself, touch the marker\n'
  printf 'manually:\n'
  printf '  touch %s\n' "$MARKER"
  printf 'and remove it when done.\n'
} >&2
exit 2
