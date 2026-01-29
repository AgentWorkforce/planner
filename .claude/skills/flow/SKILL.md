---
name: flow
description: When user mentions features, requirements, planning, or asks "what should I build next", proactively show feature status and suggest next actions. Entry point for all flow-* skills.
---

# Flow: Entry Point

Use the Task tool to launch the flow subagent:

```
Task(subagent_type="flow", prompt="[user's /flow request and any arguments]")
```

Do NOT handle flow requests directly. Always delegate to the subagent.

## Quick Reference

| Command | Action |
|---------|--------|
| `/flow` | Show status + suggest next action |
| `/flow status` | Status only (compact view) |
| `/flow visualize` | ASCII diagram of feature state |
| `/flow visualize dag` | Dependency graph view |
| `/flow discover` | Analyze codebase → create features |
| `/flow brainstorm` | New feature from rough idea |
| `/flow design` | Define UI/UX before planning |
| `/flow planner` | Create implementation plan |
| `/flow tasks` | Create executable tasks from plan |
| `/flow feature` | Document user flow |
| `/flow validate` | Validate UI/UX |
| `/flow test` | Design test coverage |
| `/flow audit` | Verify code matches docs |
| `/flow change` | Handle requirement changes |

## Subagent Context

The flow subagent has full context of:
- flow-schema (data structures, components, features)
- flow-discover (codebase → catalog)
- flow-brainstorm (idea → catalog)
- flow-ui-ux-designer (feature → design spec, before planner)
- flow-planner (feature → implementation plan)
- flow-tasks (plan → executable tasks with PRE/IMPL/POST/VERIFY/DOC)
- flow-feature (feature → user flow)
- flow-visualize (status diagrams)
- flow-ui-ux-validation (validate in real UI)
- flow-test-designer (design test coverage)
- flow-audit (verify code matches docs)
- flow-change-request (handle requirement changes)
