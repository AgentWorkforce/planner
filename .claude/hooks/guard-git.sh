#!/usr/bin/env bash
# Guard against destructive git commands.
# Claude Code PreToolUse hook for the Bash tool.
#
# Exit 0 = allow
# Exit 2 = block (stderr shown as reason)
#
# Receives JSON on stdin: { "tool_name": "Bash", "tool_input": { "command": "..." } }

set -euo pipefail

# Extract the command from JSON stdin
CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null)

if [[ -z "$CMD" ]]; then
  exit 0
fi

# --- Pattern checks ---

# 1. rm targeting .git (any flags, any path containing .git)
if echo "$CMD" | grep -qE '\brm\b.*\.(git|git/|git\b)'; then
  echo "BLOCKED: Deleting .git is catastrophic. This destroyed the repo on Feb 13. Never again." >&2
  exit 2
fi

# 2. git init (reinitializing destroys worktree links and history)
if echo "$CMD" | grep -qE '\bgit\s+init\b'; then
  echo "BLOCKED: 'git init' destroys existing repo state. This is what caused the Feb 13 disaster." >&2
  exit 2
fi

# 3. git reset --hard (destroys uncommitted work)
if echo "$CMD" | grep -qE '\bgit\s+reset\s+--hard\b'; then
  echo "BLOCKED: 'git reset --hard' causes permanent data loss. Use Edit tool to undo changes manually." >&2
  exit 2
fi

# 4. git clean -f (deletes untracked files permanently)
if echo "$CMD" | grep -qE '\bgit\s+clean\s+-[a-zA-Z]*f'; then
  echo "BLOCKED: 'git clean -f' permanently deletes untracked files. Review with 'git clean -n' first and delete manually." >&2
  exit 2
fi

# 5. git push --force / -f (can overwrite remote history)
if echo "$CMD" | grep -qE '\bgit\s+push\s+.*(-f\b|--force\b|--force-with-lease\b)'; then
  echo "BLOCKED: Force push can destroy remote history. Get explicit user confirmation first." >&2
  exit 2
fi

# 6. git checkout . (discard ALL working tree changes)
if echo "$CMD" | grep -qE '\bgit\s+checkout\s+\.\s*$'; then
  echo "BLOCKED: 'git checkout .' discards all uncommitted changes. Use Edit tool to undo specific changes." >&2
  exit 2
fi

# 7. git restore . (discard ALL working tree changes)
if echo "$CMD" | grep -qE '\bgit\s+restore\s+\.\s*$'; then
  echo "BLOCKED: 'git restore .' discards all uncommitted changes. Use Edit tool to undo specific changes." >&2
  exit 2
fi

# 8. git branch -D (force delete branch, may lose commits)
if echo "$CMD" | grep -qE '\bgit\s+branch\s+-D\b'; then
  echo "BLOCKED: 'git branch -D' force-deletes branches and may lose commits. Use -d (lowercase) for safe delete." >&2
  exit 2
fi

# 9. git stash drop / git stash clear (lose stashed work)
if echo "$CMD" | grep -qE '\bgit\s+stash\s+(drop|clear)\b'; then
  echo "BLOCKED: Dropping/clearing stashes loses work. Show stash contents first and get user confirmation." >&2
  exit 2
fi

# 10. Deleting remote branches via push
if echo "$CMD" | grep -qE '\bgit\s+push\s+\S+\s+:'; then
  echo "BLOCKED: Deleting remote branches. Get explicit user confirmation first." >&2
  exit 2
fi

# 11. rm -rf targeting any directory that could be catastrophic
if echo "$CMD" | grep -qE '\brm\s+-rf\s+/'; then
  echo "BLOCKED: 'rm -rf /' pattern detected. Use 'trash' command instead of rm." >&2
  exit 2
fi

# All checks passed
exit 0
