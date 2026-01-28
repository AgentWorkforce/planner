---
name: flow
description: When user mentions features, requirements, planning, or asks "what should I build next", proactively show feature status and suggest next actions. Entry point for all flow-* skills.
---

# Flow: Entry Point

This skill delegates to the **flow subagent** which has all flow-* skills preloaded.

When invoked, launch the flow subagent to handle the request.

## Quick Reference

| Command | Action |
|---------|--------|
| `/flow` | Show status + suggest next action |
| `/flow status` | Status only (compact view) |
| `/flow visualize` | ASCII diagram of feature state |
| `/flow visualize dag` | Dependency graph view |
| `/flow discover` | Analyze codebase → create features |
| `/flow brainstorm` | New feature from rough idea |
| `/flow planner` | Create implementation plan |
| `/flow tasks` | Create executable tasks from plan |
| `/flow feature` | Document user flow |
| `/flow validate` | Validate UI/UX |
| `/flow test` | Design test coverage |
| `/flow change` | Handle requirement changes |

## Subagent Context

The flow subagent has full context of:
- flow-schema (data structures, components, features)
- flow-discover (codebase → catalog)
- flow-brainstorm (idea → catalog)
- flow-planner (feature → implementation plan)
- flow-tasks (plan → executable tasks with PRE/IMPL/POST/VERIFY/DOC)
- flow-feature (feature → user flow)
- flow-visualize (status diagrams)
- flow-ui-ux-validation (validate in real UI)
- flow-test-designer (design test coverage)
- flow-change-request (handle requirement changes)
