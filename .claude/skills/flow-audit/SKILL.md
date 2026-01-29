---
name: flow-audit
description: Verify existing code matches feature documentation. Use for mature codebases after discover, or to verify ongoing implementation. Compares acceptance_criteria against actual code.
user-invocable: false
---
# Audit: Verify Implementation Matches Docs

**Owns**: Feature `audit` section, can update `status`

## Purpose

Compare documented acceptance criteria against actual code:
- Confirm implementation satisfies documented requirements
- Find gaps (documented but not implemented)
- Find drift (implemented but not documented)

Works for both discovered features and planned implementations.

## Prerequisites

Requires: feature file with `summary.acceptance_criteria`.

If no criteria → "Add acceptance criteria first, or run /flow discover to infer from code."

## Workflow

### 1. Identify Code to Inspect

In order of preference:
1. `key_files` array in feature (if exists)
2. Files in `plan_implementation.steps`
3. Infer from `plan_implementation.scopes` + `catalog.components` paths

### 2. Read and Analyze

For each acceptance criterion:
1. Search relevant code for evidence
2. Mark status: `satisfied` | `partial` | `missing`
3. Note evidence location (file:line) or what's missing

### 3. Check for Drift

Scan code for functionality not in acceptance criteria:
- Public APIs not documented
- Features/flags not in docs
- Significant behavior differences

### 4. Fill Audit Section

```json
{
  "audit": {
    "last_run": "2026-01-29",
    "result": "pass|partial|fail",
    "criteria": [
      { "id": "ac1", "status": "satisfied", "evidence": "src/auth.ts:45" },
      { "id": "ac2", "status": "missing", "note": "No implementation found" }
    ],
    "drift": [
      { "finding": "OAuth support exists", "file": "src/oauth.ts", "action": "document or remove" }
    ]
  }
}
```

### 5. Update Status

| Result | Status Update | Next Action |
|--------|---------------|-------------|
| All satisfied, no drift | `status: "verified"` | Done |
| Gaps found | Keep current status | Implement or `/flow change-request` to remove |
| Drift found | Keep current status | `/flow change-request` to document |

## Rules

- Be evidence-based: cite file:line for satisfied criteria
- Don't assume—if you can't find evidence, mark `missing`
- Drift isn't automatically bad—flag it, let user decide
- One feature at a time
- After completion: single-sentence summary

## Suggested Next Steps

- Gaps: implement missing functionality
- Drift: `/flow change-request` to update docs
- All pass: feature is verified
