---
name: flow-visualize
description: Use when user asks "show status", "what's the progress?", "visualize", or needs to see feature completion at a glance. Generates ASCII status diagrams and dependency graphs.
user-invocable: false
---
# Visualize: Feature Status Diagram

**Purpose**: Generate condensed ASCII diagrams showing current state of all features.

## Views

### Default: Compact Status Lines

```
my-project (approved) - 4 features, 2 components

[HIGH ✓✓✓✓✓] auth-login (approved)
[MED  ✓○○○○] auth-reset (draft) ← auth-login
[CRIT ✓✓✓○○] payments (approved) ← auth-login  
[LOW  ✓○○○○] settings (draft)

Sections: [Sum|Flow|Plan|Test|Valid]
Next: auth-reset (needs user_flow)
```

### DAG View: Dependency Boxes

Use when:
- User requests it (`/flow visualize dag`)
- User asks about blockers ("what's blocking?", "show dependencies")
- Complex dependency chains exist (>2 levels deep)

```
my-project (approved)

┌─────────────┐     ┌─────────────┐
│ auth-login  │────▶│ auth-reset  │
│ ■■■■■ HIGH  │     │ ■○○○○ MED   │
│ [approved]  │     │ [draft]     │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ payments    │
│ ■■■■○ CRIT  │
│ [approved]  │
└─────────────┘

■ = complete  ○ = missing
Sections: Sum|Flow|Plan|Test|Valid
```

## Workflow

### 1. Read Catalog

```
docs/flow/catalog.json
```

Extract: `project_id`, `status`, `components` (count), `features` (list)

### 2. Read Each Feature

```
docs/flow/features/<feature_id>.json
```

### 3. Check Section Completion

For each feature, check if these sections exist and have content:

| Section | Check |
|---------|-------|
| `summary` | Has `goal` and `acceptance_criteria` |
| `user_flow` | Has `steps` array with ≥1 step |
| `plan_implementation` | Has `steps` array with ≥1 step |
| `plan_tests` | Has `cases` array with ≥1 case |
| `validation_uiux` | Has `summary` with pass/fail values |

### 4. Build Dependency Graph

From each feature's `dependencies` array, build the DAG.

### 5. Render

**Compact view** (default):
```
[PRIO ①②③④⑤] feature-name (status) ← deps
```
Where ①②③④⑤ = Sum, Flow, Plan, Test, Valid
- `✓` = section complete
- `○` = section missing
- `●` = section partial (exists but incomplete)

**DAG view** (on request or when useful):
- Boxes for each feature
- Arrows showing dependencies
- Section status as `■○` bar

### 6. Suggest Next Action

Based on:
1. Unblocked features (no deps or all deps complete)
2. Priority order (critical > high > medium > low)
3. First missing section

## Symbols

| Symbol | Meaning |
|--------|---------|
| `✓` | Section complete |
| `○` | Section missing |
| `●` | Section partial |
| `■` | Complete (DAG view) |
| `←` | Depends on |
| `────▶` | Blocks (DAG view) |

## Priority Display

| Priority | Display |
|----------|---------|
| critical | `CRIT` |
| high | `HIGH` |
| medium | `MED ` |
| low | `LOW ` |

## Rules

- Keep output under 40 lines for compact view
- Truncate feature names to 15 chars if needed
- Show max 3 dependencies inline; use DAG view if more
- Always end with "Next:" suggestion
- If no catalog exists: "No catalog found. Run /flow discover or /flow brainstorm first."

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-todos | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| **flow-visualize** | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |
