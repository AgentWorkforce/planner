---
name: flow-ui-ux-validation
description: When feature has user_flow and user wants to verify it works in a real browser - "validate the UI", "check if it looks right", "test the flow". Uses browser automation to check present/designed/holistic for each step.
user-invocable: false
---
# UI/UX Validation: Validate in Real UI

**Owns**: Feature `validation_uiux` section

## Purpose

Walk each feature's user_flow steps in a real UI and verify:
- **Present**: visible and reachable
- **Designed**: intuitive, attractive, accessible
- **Holistic**: adheres to design system (formal or apparent)

## Prerequisites

Requires: feature file with `user_flow` section.

If `user_flow` missing → "Run /flow feature first."

## Input

- Feature file with `user_flow` section
- Runnable environment (local/staging/prod)
- Test accounts and reproducible data

## Output

Feature's `validation_uiux` section filled.

## Execution (automated preferred)

Before starting, detect or ask which automation pathway is available:

| Method | When to use |
|--------|-------------|
| **MCP Browser Tools** | Available via MCP (screenshot, DOM inspection, navigation) |
| **Puppeteer/Playwright** | Installed in project; write/run scripts to navigate and capture |
| **Claude Computer Use** | Browser control enabled in environment |

**Detection steps:**
1. Check for MCP tools—list available tools and look for:
   - Browser/screenshot capabilities (e.g., `browser-automation`, `puppeteer-mcp`, `playwright-mcp`)
   - DOM inspection tools
   - Navigation/interaction tools
2. Check `package.json` for `puppeteer`, `playwright`, `cypress`, or similar
3. If none found, ask: "No browser automation detected. Install Puppeteer or Playwright?"

**Do not default to manual.** Guide user to set up automation if needed.

## Workflow

### 1. Define Coverage

- Roles to test
- Viewports (desktop, mobile, both)
- Environment (local, staging, prod)

### 2. Walk Each Step

Execute each `user_flow` step in browser:
- Verify element is present and reachable
- Assess design quality (labels, hierarchy, feedback)
- Check consistency with rest of app

### 3. Fill Validation

```json
{
  "validation_uiux": {
    "env": "local",
    "viewport": "desktop",
    "steps": [
      {
        "step_id": "s001",
        "present": "pass",
        "designed": "pass",
        "holistic": "fail",
        "issues": [
          { "severity": "major", "issue": "Button style inconsistent", "fix": "Use primary button from design system" }
        ]
      }
    ],
    "summary": {
      "present": "pass",
      "designed": "pass",
      "holistic": "fail",
      "blockers": 0,
      "majors": 1,
      "minors": 0
    }
  }
}
```

### 4. Handle Missing UI

If a step's UI is missing:
- Set `present: fail`
- Add blocker issue with concrete fix
- Do not invent new steps; flag for flow revision if needed

### 5. Gate Updates

- Blockers exist → do not mark `published`
- Clean enough for baseline → set feature `status = "published"`

## Dimensions

| Check | What it means |
|-------|---------------|
| **present** | Element exists, visible, reachable |
| **designed** | Clear labels, good hierarchy, proper feedback, accessible |
| **holistic** | Consistent with design system across the app |

## Rules

- 1–2 questions per message. Prefer option-based questions.
- No opinions without evidence tied to a specific step
- If you cannot verify, use `unknown` and state what's missing
- After completion: single-sentence summary unless user requests more

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-tasks | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| **flow-ui-ux-validation** | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- To design test coverage: `/flow test`
- If issues found: fix and re-run `/flow validate`

## Done When

- `validation_uiux` section is filled
- All steps have present/designed/holistic checks
- Issues have concrete fixes
- Status reflects validation results
