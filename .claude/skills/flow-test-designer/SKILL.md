---
name: flow-test-designer
description: When feature has user_flow and user needs test planning - "what tests do we need?", "design test coverage". Analyzes flows to create test cases (happy/edge/error), coverage strategy, and data requirements. Does not generate test code.
user-invocable: false
---
# Test Designer: Feature → Test Design

**Owns**: Feature `plan_tests` section

## Purpose

Analyze features and design test coverage:
- What tests are needed (happy path, edge cases, error states)
- Coverage strategy (E2E, integration, unit)
- Test data requirements
- Priority assessment

Does NOT generate test code. Produces the spec for implementation.

## Prerequisites

Requires: feature file with `user_flow` section.

If `user_flow` missing → "Run /flow feature first."

## Input

- Feature file with `user_flow` section
- Optional: `validation_uiux` results
- Optional: existing test files (to identify gaps)

## Output

Feature's `plan_tests` section filled.

## Workflow

### 1. Analyze User Flow

Read `user_flow` steps:
- Identify critical paths vs optional branches
- Note external dependencies (APIs, services, auth)

### 2. Determine Coverage Level

| Flow characteristic | Coverage |
|---------------------|----------|
| User-facing critical path | E2E |
| Internal service interaction | Integration |
| Complex logic, calculations | Unit |
| Simple pass-through | Skip or minimal |

### 3. Design Test Cases

For each significant step, consider:
- **Happy path**: Normal successful execution
- **Edge cases**: Boundary values, empty states, max limits
- **Error states**: Invalid input, network failure, permission denied

### 4. Specify Data Requirements

What test data is needed?
- User accounts (roles, permissions)
- Seed data (records, relationships)
- External service mocks
- Feature flags state

### 5. Fill Plan Tests

```json
{
  "plan_tests": {
    "coverage": "e2e",
    "priority": "critical",
    "cases": [
      { "type": "happy", "description": "Valid credentials → dashboard" },
      { "type": "edge", "description": "Card at spending limit" },
      { "type": "error", "description": "Expired card shows clear error" },
      { "type": "error", "description": "Network timeout shows retry" }
    ],
    "data_requirements": [
      "Test user with valid credentials",
      "Test cards: valid, expired, limit-reached"
    ]
  }
}
```

### 6. Assign Priority

| Priority | Criteria |
|----------|----------|
| **critical** | Core user flow, revenue path, data integrity |
| **high** | Important feature, frequent use |
| **medium** | Secondary flow, less frequent |
| **low** | Edge case, nice-to-have coverage |

## Rules

- 1–2 questions per message. Prefer option-based questions.
- Design for confidence, not coverage percentage
- Be specific about data requirements—vague specs lead to flaky tests
- Skip steps that are pure assertions (already tested by prior action)
- Don't test framework behavior
- After completion: single-sentence summary unless user requests more

## Fits the Whole

| Skill | Section |
|-------|---------|
| flow-discover | `summary` (from code) |
| flow-brainstorm | `summary` (from ideas) |
| flow-planner | `plan_implementation` |
| flow-todos | Creates executable tasks from plan |
| flow-feature | `user_flow` |
| flow-ui-ux-validation | `validation_uiux` |
| **flow-test-designer** | `plan_tests` |
| flow-visualize | Reads all, renders diagram |
| flow-change-request | Updates any, cascades |

## Suggested Next Steps

- To generate actual tests: implement from plan_tests spec
- Feature complete: run `/flow` to check overall status

## Done When

- `plan_tests` section is filled
- Coverage level is assigned
- Critical paths have comprehensive cases
- Data requirements are specific
- Priority reflects business impact
