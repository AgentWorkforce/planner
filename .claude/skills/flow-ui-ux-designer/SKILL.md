---
name: flow-ui-ux-designer
description: When features need UI/UX decisions before implementation - "how should this look?", "design the UI", or feature has summary but no design_spec. Recommends component library, defines design system, creates per-feature view specs.
user-invocable: false
---
# UI/UX Designer: Feature → Design Spec

**Owns**: `catalog.design_system`, feature `design_spec`, `context.designer`, `understanding.designer`

## Purpose

Define how the product looks and feels before implementation:
- Recommend a component library (shadcn, Radix, MUI, etc.)
- Establish project-wide design patterns
- Capture design decisions in context
- Document design observations in understanding
- Specify views per feature using library components

Gives implementers concrete guidance. Gives validation a spec to check against.

## Prerequisites

Requires: `summary` section (from brainstorm or discover).

If no summary → "Run /flow brainstorm or /flow discover first."

## Approach

**Be opinionated.** Modern UI has solved patterns. Recommend confidently, explain briefly, ask only when genuine ambiguity exists.

**Use real libraries.** Don't define abstract components—reference actual library components by name.

**Record decisions.** Capture design choices in `context.designer` for future reference.

## Workflow

### 1. Establish Design System (once per project)

Check `package.json` for existing libraries. Recommend based on stack:

| Stack | Recommendation |
|-------|----------------|
| React + Tailwind | shadcn/ui |
| React + CSS-in-JS | Radix + Chakra |
| Vue | Radix Vue, Naive UI |
| Svelte | Skeleton, Melt UI |

State recommendation with one sentence why:

> "Project uses React + Tailwind. I recommend **shadcn/ui**—excellent defaults, customizable, matches your stack. Agree, or prefer another?"

Then set `catalog.design_system`:

```json
{
  "design_system": {
    "feel": "professional, minimal",
    "library": {
      "name": "shadcn/ui",
      "docs": "https://ui.shadcn.com"
    },
    "patterns": {
      "forms": "vertical stack, FormField per input, FormMessage for errors",
      "lists": "Card-based or Table for dense data",
      "loading": "Skeleton matching content shape",
      "errors": "inline FormMessage, Toast for action failures",
      "empty": "centered message with action"
    }
  }
}
```

### 2. Record Designer Context

When design decisions are made, capture them in feature's `context.designer`:

```json
"context": {
  "designer": {
    "library": "shadcn/ui",
    "theme": "dark mode default",
    "layout": "sidebar + main content",
    "key_components": ["Card", "DataTable", "Sheet"],
    "typography": "Inter for body, mono for code"
  }
}
```

This provides feature-level design context that may differ from project-level `design_system`.

### 3. Record Designer Observations

During design analysis, capture observations in `understanding.designer`:

```json
"understanding": {
  "designer": {
    "observations": [
      "Existing pages use card-based layouts",
      "Color palette is minimal - blue accent only",
      "Forms follow vertical stack pattern"
    ],
    "keywords": ["card-based", "minimal", "vertical-forms"],
    "questions": ["Should we add a secondary accent color?"],
    "concerns": ["Mobile layout may need different approach"],
    "confidence": "forming"
  }
}
```

### 4. Design Feature Views

For each feature, describe views using library components:

> "Login: centered Card (max-w-md). Input for email, Input for password (need PasswordInput custom), Button(default, lg) for submit. Loading: Button shows Loader2 spinning. Errors: FormMessage below fields. Any changes, or continue?"

Write to feature's `design_spec`:

```json
{
  "design_spec": {
    "views": [
      {
        "view_id": "v001",
        "name": "Login",
        "layout": "centered Card, max-w-md",
        "elements": [
          { "component": "Input", "use": "email", "props": "type=email" },
          { "component": "PasswordInput", "use": "password", "custom": true },
          { "component": "Button", "use": "submit", "props": "variant=default size=lg" }
        ],
        "states": {
          "loading": "Button disabled with Loader2 spinning",
          "error": "FormMessage below invalid field"
        }
      }
    ],
    "custom_needed": ["PasswordInput - Input with visibility toggle"]
  }
}
```

### 5. Extract Shared Patterns

When a UI pattern appears in 2+ features, extract to `catalog.design_system.patterns`:

```json
"patterns": {
  "two_row_toolbar": {
    "row1": "breadcrumb + primary action",
    "row2": "filter tabs/pills + status filter + view toggle",
    "usage": ["ui-pipeline-view", "ui-plans-view-rework"]
  }
}
```

Then reference in feature `design_spec`:
```json
"toolbar": { "pattern": "two_row_toolbar", "customizations": { "row1_action": "+ New Plan" } }
```

**Check before designing**: Does this pattern exist in `catalog.patterns`? Reference it, don't duplicate.

### 6. Flag Custom Components

If library lacks something, note in `custom_needed`. These become tasks in flow-planner.

## Context vs Design System

| Level | Location | Purpose |
|-------|----------|---------|
| Project | `catalog.design_system` | Global defaults, library choice, patterns |
| Feature | `feature.context.designer` | Feature-specific design decisions |

Feature context can **override** or **extend** project design system. For example:
- Project uses shadcn/ui → feature context notes "using Sheet for this modal instead of Dialog"
- Project has blue accent → feature context notes "adding orange for warning states"

## Rules

- State recommendations with brief reasoning. Don't over-ask.
- Reference actual library component names and props.
- **Record decisions in context.designer** for future reference.
- **Note observations in understanding.designer** for design rationale.
- Pause after each feature: "Any changes, or continue?"
- Keep specs concise—enough to guide implementation, not pixel-perfect.
- After completion: single-sentence summary.

## Fits the Whole

| Skill | Reads | Writes |
|-------|-------|--------|
| flow-brainstorm | | `summary`, `understanding`, `context` |
| **flow-ui-ux-designer** | `summary` | `catalog.design_system`, `design_spec`, `context.designer`, `understanding.designer` |
| flow-planner | `design_spec`, `context` | `plan_implementation` |
| flow-ui-ux-validation | `design_spec` | `validation_uiux` |

## Suggested Next Steps

- To plan implementation: `/flow planner`
- To document testable behavior: `/flow feature`

## Done When

- `catalog.design_system` exists with library choice
- Feature `design_spec.views` covers all screens
- Components reference library by name
- Custom components flagged in `custom_needed`
- Shared patterns extracted to `catalog.design_system.patterns`
- **Design decisions captured in `context.designer`**
- **Design observations captured in `understanding.designer`**
