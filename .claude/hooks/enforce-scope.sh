#!/usr/bin/env bash
#
# enforce-scope.sh
#
# PreToolUse hook for Write / Edit / MultiEdit. Phase 6 deliverable.
#
# Rejects writes outside the active chain's spec.scope_paths glob.
# Active chain is the one with current_step == "builder" in
# .claude/memory/live/<id>/chain.json.
#
# Contract (verified from claude-code-action docs 2026-05-28):
#   stdin: JSON with tool_name, tool_input.file_path, cwd, ...
#   exit 0: allow
#   exit 2: block + stderr shown to Claude as feedback
#   exit other non-zero: non-blocking error (logged but tool still runs)
#
# Requires: jq, bash 3.2+ (macOS default; portable to GitHub runners).

set -uo pipefail

# Capture stdin once; jq it multiple times.
TOOL_JSON="$(cat)"

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$TOOL_JSON")"
TARGET_PATH="$(jq -r '.tool_input.file_path // empty' <<<"$TOOL_JSON")"
CWD="$(jq -r '.cwd // empty' <<<"$TOOL_JSON")"

# Only enforce for file-mutating tools. Read/Glob/Grep/Bash etc. are allowed unconditionally.
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# If no target path was provided, defer to the tool (it will error out).
[ -z "$TARGET_PATH" ] && exit 0

# Locate the repo root. cwd from the hook payload is the safest source.
REPO_ROOT="${CWD:-$(pwd)}"
if [ ! -d "$REPO_ROOT/.claude/memory/live" ]; then
  # No live store exists; can't be an active chain. Allow.
  exit 0
fi

# Find every chain with current_step == "builder".
ACTIVE_CHAINS=()
for chain_dir in "$REPO_ROOT/.claude/memory/live"/*/; do
  [ -d "$chain_dir" ] || continue
  chain_json="$chain_dir/chain.json"
  [ -f "$chain_json" ] || continue
  step="$(jq -r '.current_step // empty' "$chain_json" 2>/dev/null)"
  if [ "$step" = "builder" ]; then
    ACTIVE_CHAINS+=("$(basename "$chain_dir")")
  fi
done

# No active builder chain -> allow (maintainer doing something outside the chain).
if [ "${#ACTIVE_CHAINS[@]}" -eq 0 ]; then
  exit 0
fi

# More than one active builder chain -> ambiguous. Refuse and explain.
if [ "${#ACTIVE_CHAINS[@]}" -gt 1 ]; then
  printf 'enforce-scope: multiple chains are in builder step (%s); cannot determine which scope_paths apply. Mark all but one as completed before the next write.\n' "${ACTIVE_CHAINS[*]}" >&2
  exit 2
fi

CHAIN_ID="${ACTIVE_CHAINS[0]}"
SPEC_FILE="$REPO_ROOT/specs/${CHAIN_ID}.md"

# If the spec is absent, log to stderr and allow (the validator will catch
# this as a downstream finding; the hook does not invent scope).
if [ ! -f "$SPEC_FILE" ]; then
  printf 'enforce-scope: chain %s is in builder step but %s does not exist; allowing write.\n' "$CHAIN_ID" "$SPEC_FILE" >&2
  exit 0
fi

# Extract scope_paths block. Format in spec is exactly:
#   ## scope_paths
#
#   ```
#   path/one
#   path/two
#   ```
# Use awk: from "^## scope_paths" until the second triple-backtick, print
# lines between the fences.
SCOPE_PATHS="$(awk '
  /^## scope_paths/ { in_section = 1; next }
  in_section && /^```/ { fence_count++; if (fence_count == 2) exit; next }
  in_section && fence_count == 1 { print }
' "$SPEC_FILE")"

if [ -z "$SCOPE_PATHS" ]; then
  printf 'enforce-scope: spec %s does not declare scope_paths in a fenced block; allowing write.\n' "$SPEC_FILE" >&2
  exit 0
fi

# Normalise the target path to repo-relative for matching.
case "$TARGET_PATH" in
  "$REPO_ROOT"/*) TARGET_REL="${TARGET_PATH#$REPO_ROOT/}" ;;
  /*)             TARGET_REL="$TARGET_PATH" ;;
  *)              TARGET_REL="$TARGET_PATH" ;;
esac

# Always allow writes to the chain's own working area.
case "$TARGET_REL" in
  .claude/memory/live/${CHAIN_ID}/*) exit 0 ;;
esac

# Check each scope_path with bash glob match. Allow if any matches.
ALLOWED=0
while IFS= read -r scope; do
  # Trim leading/trailing whitespace.
  scope="${scope#"${scope%%[![:space:]]*}"}"
  scope="${scope%"${scope##*[![:space:]]}"}"
  [ -z "$scope" ] && continue
  # Exact match.
  if [ "$TARGET_REL" = "$scope" ]; then
    ALLOWED=1
    break
  fi
  # Glob match (** is broader than bash's *; do a simple ** -> * substitution
  # so `dir/**` matches `dir/anything/nested/path`).
  glob_pattern="${scope//\*\*/*}"
  # shellcheck disable=SC2053
  if [[ "$TARGET_REL" == $glob_pattern ]]; then
    ALLOWED=1
    break
  fi
done <<< "$SCOPE_PATHS"

if [ "$ALLOWED" -eq 0 ]; then
  {
    printf 'enforce-scope: write to "%s" rejected for chain %s.\n' "$TARGET_REL" "$CHAIN_ID"
    printf '\n'
    printf 'Active scope_paths from %s:\n' "$SPEC_FILE"
    while IFS= read -r scope; do
      scope="${scope#"${scope%%[![:space:]]*}"}"
      scope="${scope%"${scope##*[![:space:]]}"}"
      [ -z "$scope" ] && continue
      printf '  - %s\n' "$scope"
    done <<< "$SCOPE_PATHS"
    printf '\n'
    printf 'To widen scope: amend %s and add the path. Per CLAUDE.md rule 13, importers of a changed interface are implicitly in scope; list them up front.\n' "$SPEC_FILE"
  } >&2
  exit 2
fi

exit 0
