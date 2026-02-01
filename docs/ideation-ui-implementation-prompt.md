# Ideation UI Implementation Agent Prompt

## Your Mission

You are an implementation agent responsible for building the **Ideation UI** — a React frontend for the ideation brainstorming package. This is part of the Planner product suite.

## Setup: Load Tasks

**FIRST**, read the task definitions from `docs/frontend-tasks.json`. This file contains 54 pre-planned tasks covering 4 features.

Using your **todo** tool, create each task **exactly as specified** in the JSON file:
- Use the `subject` field as the task title
- Use the `description` field as the task description
- Use the `activeForm` field for the spinner text
- Set `blockedBy` using the task IDs from the `blockedBy` array

The task IDs in the file (#163-#216) are for reference. Map them to whatever IDs your todo system assigns, but **preserve the dependency relationships**.

### Import Order

Import tasks feature-by-feature, in this order (respecting cross-feature dependencies):

1. **ideation-ui-layout** (#163-#175) — 13 tasks, no external dependencies
2. **ideation-ui-session-list** (#176-#187) — 12 tasks, depends on layout CHECKPOINT
3. **ideation-ui-chat** (#188-#203) — 16 tasks, depends on layout CHECKPOINT
4. **ideation-ui-specialists-panel** (#204-#216) — 13 tasks, depends on layout CHECKPOINT

## Task Types Explained

Each feature follows a PRE → IMPL → POST → VERIFY → DOC → CHECKPOINT pattern:

| Type | Purpose |
|------|---------|
| **PRE** | Analyze existing code before implementing. Check context usage. |
| **IMPL** | Build the actual component/hook/feature |
| **POST** | PR-style review of your own code. Fix bugs, slop, inconsistencies. |
| **VERIFY** | Confirm acceptance criteria are met. Run type checks. |
| **DOC** | Compare implementation to plan. File change requests if diverged. |
| **CHECKPOINT** | Context check. Report context %. Compact if > 50%. |

## Implementation Guidelines

### Architecture Context

The ideation UI lives in `packages/ideation-ui/` (you may need to create this). Key decisions:

- **Framework**: React + TypeScript + Tailwind CSS v4
- **Design System**: Mission Control aesthetic (dark theme, neon accents: cyan, purple)
- **State**: React hooks + localStorage for preferences
- **API**: Calls `packages/ideation/` backend via proxy (same-origin pattern)
- **Real-time**: SSE for session updates via `/api/ideation/sessions/:id/events`

### Design Token Reference

```css
/* Colors */
--color-bg-primary: #0a0e14
--color-bg-secondary: #111620
--color-bg-tertiary: #1a1f2e
--color-accent-cyan: #00d9ff
--color-accent-purple: #a78bfa
--color-text-primary: #e2e8f0
--color-text-muted: #64748b
--color-success: #22c55e
--color-warning: #f59e0b
--color-error: #ef4444
```

### Key Files to Reference

- **Feature specs**: `docs/flow/features/ideation-ui-*.json` — acceptance criteria for each component
- **Backend types**: `packages/ideation/src/domain/types.ts` — Session, Transcript, Understanding types
- **Existing planner UI**: `src/components/` — reference patterns for hooks, layouts, design consistency

### Parallel Execution Strategy

You can run agents in parallel for:
- **Independent IMPL tasks within the same feature** (if no blockedBy relationship)
- **POST/VERIFY/DOC within the same feature** (often can overlap)
- **Multiple features simultaneously** (once their dependencies are met)

Do NOT parallelize:
- PRE tasks (need full codebase context)
- Tasks with explicit blockedBy relationships
- CHECKPOINT tasks (context synchronization points)

### Quality Standards

1. **No over-engineering**: Build exactly what's specified. No extra features, abstractions, or "future-proofing"
2. **Match existing patterns**: Look at planner UI code. Use the same hook patterns, component structure, naming conventions
3. **Type safety**: Strict TypeScript. No `any` types. Use Zod for runtime validation if needed.
4. **Accessibility**: Proper focus states, ARIA labels where appropriate
5. **Real-time updates**: Use SSE subscriptions, not polling

### When Stuck

- Read the feature file (`docs/flow/features/ideation-ui-*.json`) for acceptance criteria details
- Check similar components in `src/components/` for patterns
- If spec is ambiguous, make a reasonable decision and note it in DOC task

## Begin

1. Read `docs/frontend-tasks.json`
2. Create all 54 tasks using your todo tool, preserving dependencies
3. Start with task #163 (PRE for ideation-ui-layout)
4. Work autonomously through all tasks
5. Run agents in parallel where dependency graph allows

Do not ask clarifying questions. The specs are complete. Make reasonable decisions and document any deviations in DOC tasks.
