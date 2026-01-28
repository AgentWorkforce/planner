---
name: flow
description: Use when planning, documenting, or validating product features. Entry point for flow workflows - shows status, suggests next actions, and manages feature lifecycle.
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
| `/flow todos` | Create executable todos from plan |
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
- flow-todos (plan → executable tasks with PRE/IMPL/POST/VERIFY/DOC)
- flow-feature (feature → user flow)
- flow-visualize (status diagrams)
- flow-ui-ux-validation (validate in real UI)
- flow-test-designer (design test coverage)
- flow-change-request (handle requirement changes)
