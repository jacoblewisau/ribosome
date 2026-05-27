#!/usr/bin/env bash
#
# block-secrets.sh
#
# Pre-commit guard for Ribosome. Two layers:
#
#   1. Filename layer: reject staged files whose basename matches dangerous
#      patterns (.env, *.key, *.pem, secrets.*). Allowlist for explicit
#      template suffixes (.example, .sample, .template, .dist).
#
#   2. Content layer: scan added lines in the staged diff for known secret
#      shapes (AWS access key id, GitHub PATs classic and fine-grained,
#      Anthropic API key).
#
# Fails loud with the offending paths and pattern names. Exits non-zero so
# the commit is rejected. To bypass for a single commit (only when certain),
# use `git commit --no-verify`.
#
# Designed for bash 3.2+ (macOS default). No associative arrays. No GNU-only
# grep flags beyond -E and -o which BSD grep supports.

set -uo pipefail

# Colour only when stdout is a tty.
if [ -t 1 ]; then
  RED=$'\033[1;31m'
  YELLOW=$'\033[1;33m'
  RESET=$'\033[0m'
else
  RED=""
  YELLOW=""
  RESET=""
fi

VIOLATIONS=()

# ----- 1. filename layer -----------------------------------------------------

# Suffixes that mark a file as a safe template, not a secret.
SAFE_TEMPLATE_RE='(\.example|\.sample|\.template|\.dist)$'

# Added, copied, modified, renamed, type-changed. Skip deletions.
STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMRT 2>/dev/null || true)"

if [ -n "$STAGED_FILES" ]; then
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    base="$(basename "$path")"

    if [[ "$base" =~ $SAFE_TEMPLATE_RE ]]; then
      continue
    fi

    if [[ "$base" == ".env" ]] || [[ "$base" =~ ^\.env\. ]]; then
      VIOLATIONS+=("filename  $path  (matches .env)")
      continue
    fi
    if [[ "$base" == *.key ]]; then
      VIOLATIONS+=("filename  $path  (matches *.key)")
      continue
    fi
    if [[ "$base" == *.pem ]]; then
      VIOLATIONS+=("filename  $path  (matches *.pem)")
      continue
    fi
    if [[ "$base" == secrets.* ]]; then
      VIOLATIONS+=("filename  $path  (matches secrets.*)")
      continue
    fi
  done <<< "$STAGED_FILES"
fi

# ----- 2. content layer ------------------------------------------------------

# Only look at added lines (start with + but not the +++ file headers).
ADDED_LINES="$(git diff --cached --no-color --unified=0 2>/dev/null | grep -E '^\+[^+]' || true)"

# Parallel arrays: name and ERE pattern. Note: each ERE literal here starts
# with a fixed prefix and uses a bracket expression for the variable part.
# That means the regex literal itself does not satisfy the regex, so this
# file is safe to commit through its own check.
PATTERN_NAMES=(
  "aws_access_key_id"
  "github_classic_pat"
  "github_fine_pat"
  "anthropic_api_key"
)
PATTERN_REGEX=(
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{82}'
  'sk-ant-[A-Za-z0-9_-]{32,}'
)

if [ -n "$ADDED_LINES" ]; then
  i=0
  while [ "$i" -lt "${#PATTERN_NAMES[@]}" ]; do
    name="${PATTERN_NAMES[$i]}"
    pattern="${PATTERN_REGEX[$i]}"
    matches="$(printf '%s\n' "$ADDED_LINES" | grep -oE "$pattern" || true)"
    if [ -n "$matches" ]; then
      while IFS= read -r m; do
        [ -z "$m" ] && continue
        prefix="${m:0:8}"
        VIOLATIONS+=("content   pattern=$name  match=${prefix}...")
      done <<< "$matches"
    fi
    i=$((i + 1))
  done
fi

# ----- report ----------------------------------------------------------------

if [ "${#VIOLATIONS[@]}" -gt 0 ]; then
  printf '%sblock-secrets: commit rejected%s\n' "$RED" "$RESET" >&2
  printf '\n' >&2
  for v in "${VIOLATIONS[@]}"; do
    printf '  %s\n' "$v" >&2
  done
  printf '\n' >&2
  printf '%sto bypass for one commit (only when you are certain):%s\n' "$YELLOW" "$RESET" >&2
  printf '  git commit --no-verify\n' >&2
  printf '\n' >&2
  printf 'remove the offending files or content, then re-stage and re-commit.\n' >&2
  exit 1
fi

exit 0
