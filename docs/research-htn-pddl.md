# Research: HTN/PDDL and Formal Planning

## Why Formal Planning?

The blueprint conversation explores using formal planning techniques (HTN, PDDL) for:
1. Better control of agent output
2. Verification that plans are sound
3. Automatic decomposition of complex tasks
4. Consistency checking

**Key insight from research**: "Most industrial strength planners are HTN based" — this isn't just academic; it's practical.

## HTN (Hierarchical Task Network) Planning

### Core Concept

HTN planning starts with a **task** (not a goal) and decomposes it recursively:

```
Abstract Task
    ↓ (decompose via method)
[Subtask 1, Subtask 2, Subtask 3]
    ↓ (decompose further)
[Primitive Action, Primitive Action, ...]
```

**Key difference from classical planning**:
- Classical: "Here's the goal state, find actions to reach it"
- HTN: "Here's the task, decompose it into executable actions"

HTN mirrors how humans solve problems — breaking big tasks into smaller ones.

### Task Types

| Type | Description |
|------|-------------|
| **Primitive Task** | Directly executable action (operator) |
| **Compound Task** | Must be decomposed via a method |
| **Goal Task** | Achievement condition (optional in some HTN variants) |

### Methods

Methods define how to decompose compound tasks:

```
Method: build-house
  Task: construct-building(house)
  Preconditions: has-permit, has-land
  Subtasks: [
    lay-foundation,
    build-frame,
    install-roof,
    finish-interior
  ]
```

### Total-Order Forward Decomposition (TFD)

Simplest HTN algorithm:

1. If task list is empty → return plan
2. If first task is **primitive**:
   - Find applicable operator
   - Apply to state
   - Continue with rest of tasks
3. If first task is **compound**:
   - Find applicable method
   - Replace task with method's subtasks
   - Continue

Result: sequence of primitive actions that accomplish the original task.

**Why TFD is practical**: "Makes it relatively easier to implement and analyze" — uses sequences, not complex graphs.

## PDDL (Planning Domain Definition Language)

### Core Concept

PDDL is a standardized language for describing planning problems:

```pddl
(define (domain logistics)
  (:predicates
    (at ?obj ?loc)
    (in ?pkg ?truck)
  )

  (:action load
    :parameters (?pkg ?truck ?loc)
    :precondition (and (at ?pkg ?loc) (at ?truck ?loc))
    :effect (and (in ?pkg ?truck) (not (at ?pkg ?loc)))
  )
)
```

### PDDL Components

| Component | Purpose |
|-----------|---------|
| **Domain** | Predicates and actions available |
| **Problem** | Initial state and goal |
| **Predicates** | Properties that can be true/false |
| **Actions** | Operators with preconditions and effects |

### Why PDDL Matters

1. **Formal verification**: Can prove plans are sound
2. **Automated planning**: Solvers can generate plans
3. **Interoperability**: Standard format for planners
4. **Expressiveness**: Rich language for complex domains

## HTN + PDDL Hybrid

Modern practical systems often combine both:
- HTN for task decomposition structure
- PDDL-style preconditions/effects for verification

## Application to Agent Planning

### How HTN Fits

The Planner could use HTN concepts:

```
User Goal: "Add authentication to the app"
    ↓ (decompose)
[Research auth methods, Design auth flow, Implement backend, Implement frontend, Test]
    ↓ (decompose further)
[
  Research: [search docs, compare options, write recommendation],
  Design: [create diagrams, get approval],
  Backend: [create models, create endpoints, add middleware],
  ...
]
```

Each decomposition produces steps with:
- Dependencies (what must complete first)
- Acceptance criteria (how to verify)
- Role requirements (who can do this)

### How PDDL-Style Verification Fits

Steps could have preconditions and effects:

```typescript
interface Step {
  step_id: string;
  title: string;

  // PDDL-inspired additions:
  preconditions?: Predicate[];  // Must be true to start
  effects?: Predicate[];        // Will be true after completion
}

interface Predicate {
  name: string;        // e.g., "file_exists", "tests_pass"
  args: string[];      // e.g., ["src/auth/middleware.ts"]
  negated?: boolean;   // true = this should NOT be true
}
```

This enables:
- Automatic dependency inference (effect of A matches precondition of B)
- Validation (can this plan actually work?)
- Gap detection (no step produces required predicate)

### Hiding Formalism from Users

**Key requirement**: Formalism should be "hidden" by default.

**Approach**:
1. Users write natural language plans
2. LLM generates formal representation behind the scenes
3. Formal representation used for validation/verification
4. Advanced users can inspect/edit formal model

```
User sees:
  "1. Set up database schema"

System generates:
  Step {
    title: "Set up database schema"
    preconditions: [file_exists("prisma/schema.prisma")]
    effects: [
      schema_defined("User"),
      schema_defined("Session"),
      migrations_ready()
    ]
  }
```

## Practical HTN Implementations

### Fluid HTN (C#)
- Total-order forward decomposition
- Builder pattern API
- Used in game AI

### SHOP2 (Lisp)
- Academic reference implementation
- Domain-independent
- Supports partial-order planning

### Pyhop (Python)
- Simple Python HTN planner
- Easy to understand/modify
- Good for learning

### MCTS-HTN
- Monte Carlo Tree Search + HTN
- Handles uncertainty
- Real-time planning

## Recommendation for Planner

### Phase 1: Pragmatic Schema
Start with a practical schema:
- Steps + dependencies (explicit DAG)
- Acceptance criteria (natural language)
- Role assignments

### Phase 2: Optional Formal Layer
Add HTN-inspired decomposition:
- Compound tasks that expand to subtasks
- Methods library for common decompositions

### Phase 3: Verification (if needed)
Add PDDL-style preconditions/effects:
- For critical workflows
- Automated validation
- Gap detection

**Key principle**: Formalism should provide value (validation, automation) without burdening users. It's an implementation detail, not a user-facing feature.

## Open Questions

1. **Where does decomposition happen?** In Planner (before approval) or Orchestrator (at runtime)?
2. **Who defines methods?** Static library vs. LLM-generated vs. learned from history?
3. **How formal is formal?** Full PDDL semantics vs. lightweight precondition checks?

## Sources

- [Wikipedia: Hierarchical Task Network](https://en.wikipedia.org/wiki/Hierarchical_task_network)
- [GeeksforGeeks: HTN Planning in AI](https://www.geeksforgeeks.org/artificial-intelligence/hierarchical-task-network-htn-planning-in-ai/)
- [Towards Data Science: Total-Order Forward Decomposition](https://towardsdatascience.com/total-order-forward-decomposition-an-htn-planner-cebae7555fff/)
- [Game AI Pro: Exploring HTN Planners](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter12_Exploring_HTN_Planners_through_Example.pdf)
- [arXiv: Overview of HTN Planning](https://arxiv.org/abs/1403.7426)
- [Fluid HTN GitHub](https://github.com/ptrefall/fluid-hierarchical-task-network)
