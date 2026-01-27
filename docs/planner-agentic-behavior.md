# Planner: Agentic Behavior

## Core Principle

> **AI handles the tedious. Humans make the decisions. Most of what AI does is invisible.**

---

## The Visibility Spectrum

```
Silent                    Subtle                    Explicit
(just do it)              (badge/indicator)         (needs decision)
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────┐              ┌─────────┐              ┌─────────┐
│ Format  │              │ "3 items│              │ Approve │
│ Deps    │              │ improved│              │ Publish │
│ Clarify │              │ (click) │              │ Merge?  │
└─────────┘              └─────────┘              └─────────┘

Low risk                                          High risk
Obvious                                           Judgment
Reversible                                        Irreversible
```

---

## Silent (No Notification)

AI does these automatically. User doesn't need to know.

| Action | Why Silent |
|--------|------------|
| Add missing acceptance criteria | Obvious improvement |
| Fix missing dependencies | Structural correctness |
| Clarify vague descriptions | Enhancement, not change |
| Format inconsistencies | Cosmetic |
| Create versions on change | Infrastructure |

**Rationale**: If you wouldn't interrupt someone to tell them, don't show a notification.

---

## Subtle (Indicator Only)

AI did something. User can look if curious.

| Action | Indicator |
|--------|-----------|
| Multiple improvements made | Badge: "3 items improved" (expandable) |
| Draft generated from goal | Shows result directly |
| Potential issues detected | Inline markers in editor |

**Rationale**: User might want to know, but doesn't need to act.

---

## Explicit (Requires Human)

These always need human decision or action.

| Action | Why Human |
|--------|-----------|
| **Approve** | Locks plan, accountability |
| **Publish** | Releases to orchestrator, commitment |
| **Ambiguous choices** | "Steps 4 and 6 overlap. Merge?" |
| **Scope concerns** | "This seems larger than stated goal" |
| **Change requests** | Orchestrator wants plan modified |

**Rationale**: Irreversible, or multiple valid options, or strategic.

---

## AI Behavior Summary

**Always running**: AI improves the plan as you work. No "request AI review" button needed.

**Continuous, not triggered**: AI doesn't wait for state transitions. It works in the background.

**Invisible by default**: Only surface what the human actually needs to see or decide.

---

## Protected Actions

No matter what, AI never does these:

| Action | Why Protected |
|--------|---------------|
| Submit plan | Coordination signal to Portfolio/reviewers |
| Approve plan | Human accountability |
| Publish plan | Human commitment |
| Delete/archive | Irreversible |
| Add approval gates | Workflow governance |

---

## The Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Human writes goal → AI drafts plan → Human refines           │
│                              ↓                                  │
│                    AI improves silently                         │
│                              ↓                                  │
│          Human submits when ready for review                    │
│                              ↓                                  │
│   Portfolio/reviewers evaluate → Human approves                 │
│                              ↓                                  │
│              Human publishes when ready                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The human's job is:
1. Express intent (goal)
2. Submit when ready for Portfolio/reviewer evaluation
3. Approve when the plan is signed off
4. Publish when ready to execute

AI does everything else automatically.
