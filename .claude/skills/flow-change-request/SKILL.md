---
name: flow-change-request
description: Use when user says "actually we need", "change X to Y", "add/remove this requirement", or implementation diverged from plan. Updates features and cascades to dependents.
user-invocable: false
---
# Change Request: Update Requirements

**Owns**: Updates any section, cascades to dependents

## Purpose

Handle changes to existing requirements:
- Update affected feature summaries
- Identify cascade effects
- Re-run dependent skills

## When to Use

- Requirements change after brainstorm
- Missing acceptance criteria discovered
- Scope change (add/remove functionality)
- Correction or pivot mid-development

## Prerequisites

Requires: existing `docs/flow/catalog.json` and feature files.

If missing → "No existing features. Run /flow discover or /flow brainstorm first."

## Workflow

### 1. Identify Affected Features

Parse change description. Match to existing features.

If unclear: "Which feature does this affect?" + list features.

### 2. Show Current State

```
Feature: auth-login
Goal: "Allow users to authenticate via OAuth"
Criteria:
- ac1: User can log in with valid credentials
- ac2: Invalid credentials show clear error
```

### 3. Propose Updates

```
Proposed changes to auth-login:
+ ac3: User can enable 2FA via authenticator app
+ ac4: 2FA required for admin users

Accept? [Y/n/edit]
```

### 4. Identify Cascade Effects

| If changed | May affect |
|------------|------------|
| summary | user_flow, plan_implementation |
| user_flow | plan_tests, validation_uiux |
| understanding | context (decisions derive from observations) |
| context | plan_implementation, design_spec (decisions inform plans) |
| design_spec | plan_implementation.steps.specification.design |
| specification | (implementation work—flag for developer review) |
| plan_implementation | (implementation work—flag for developer review) |

```
Cascade effects:
- user_flow: may need new steps for 2FA
- plan_tests: may need new test cases

Re-run these? [Y/n/select]
```

### 5. Execute

1. Update affected section
2. If confirmed, invoke sub-skills for affected sections
3. Pass context: "Updating due to: <change description>"

### 6. Summary

"Updated auth-login: added 2FA requirements. Re-ran user_flow and plan_tests."

## Rules

- Use `mcp__conductor__AskUserQuestion` for choices; 1–2 questions max.
- Show proposed changes before applying
- Ask confirmation before re-running skills
- Be surgical—only update what's affected
- Handle one feature at a time if multiple affected
- Output ≤1 sentence summary when done

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary`, `understanding`, `context` (from code) |
| flow-brainstorm | `summary`, `understanding`, `context` (from ideas) |
| flow-ui-ux-designer | `design_spec`, `context.designer`, `understanding.designer` |
| flow-planner | `plan_implementation` (with step `specification`) |
| flow-tasks | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| flow-test-designer | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| **flow-change-request** | Updates any, cascades |
