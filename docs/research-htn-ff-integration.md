# Research: HTN-FF Integration Paper

## Paper Overview

**Title**: Integrating HTN Planning and Classical Planning (inferred from content)
**Authors**: Baier, Bacchus, McIlraith, et al.
**Key Contribution**: Shows how to augment the FF (Fast Forward) classical planner with HTN (Hierarchical Task Network) domain knowledge to improve planning performance.

## Core Concepts

### The Problem

Classical planners (like FF, using PDDL) are **domain-independent**:
- They work on any problem expressed in PDDL
- They don't need domain-specific knowledge
- But they can be slow on complex problems

HTN planners (like SHOP, SHOP2) use **domain-configurable knowledge**:
- Methods describe how to decompose tasks into subtasks
- Faster when good methods exist
- But require domain engineering

### The Solution: FF-HTN

The paper shows how to combine both approaches:
- Use HTN methods to guide the search
- Fall back to classical planning when methods don't apply
- Get the best of both worlds

## Key Technical Details

### Translation Schema

The paper defines a translation from HTN problems to classical planning:

**Case 1**: `subtasks(m) = ∅` (primitive action)
- Method `m` produces an operator directly

**Case 2**: `subtasks(m) = {t₁, ..., tₙ}` (compound task)
- Method decomposes into subtasks
- Recursive application until all tasks are primitive

### Formal Properties

**Theorem 1**: For an HTN planning problem `(s, d, D)` where `s ∈ Σ` is an HTN planning problem, `(s, d, D)` has a solution iff there exists a sequence of methods/operators that:
- Starts from initial state
- Achieves goal conditions
- Respects method preconditions

The paper proves **correctness** and analyzes **computational complexity** of the translation scheme.

## Experimental Results

### Towers of Hanoi Domain

| Planner | Performance |
|---------|-------------|
| FF-Plain | Struggles with >25 disks |
| FF-HTN | Solves problems ~4.2 orders of magnitude faster |

The HTN method for Towers of Hanoi:
- **Method to move a disk**: Recursive decomposition
- Always move the smallest disk that was not last moved
- Largest disk at bottom, can be on any peg

### Office Delivery Domain

Transportation problem: robot picks up and delivers packages in a building.

Results (Figure 3):
- FF-Plain: Many runs failed to finish in 2 hours
- FF-HTN: Consistently faster
- At 25 blocks, FF-HTN was ~4.2 orders of magnitude faster

### Blocks World

Classic planning benchmark:
- FF-HTN ~2.8x and ~1.9x faster than FF-Plain
- Performance gain less dramatic than Towers of Hanoi
- But still significant improvement

## Related Work Mentioned

| System | Approach |
|--------|----------|
| **SHOP/SHOP2** | Domain-configurable HTN planners |
| **ANML** | Action Notation Modeling Language (alternative to PDDL) |
| **TALplanner** | Temporal logic planning |
| **LPG** | Local search planner with action graphs |
| **O-Plan** | Open planning architecture |

The paper notes that ANML translation has "several similarities to ours, but a difference that can significantly affect planning time and solutions found."

## Conclusions (from paper)

1. HTN planning knowledge can be **easily translated** to PDDL-style planning
2. The translation is **correct** and preserves problem structure
3. Performance improvements are **significant** (orders of magnitude in some domains)
4. HTN + classical planning is **complementary**, not competing
5. Domain knowledge (methods) **guides search** without requiring complete HTN specification

## Relevance to Planner

### High Relevance

This paper validates several of our design decisions:

| Paper Finding | Planner Implication |
|---------------|---------------------|
| HTN methods guide decomposition | Our "compound task" concept is sound |
| Methods can be optional | Don't require full HTN specification |
| Classical planning as fallback | Can plan without methods when needed |
| Domain knowledge improves performance | Methods library is valuable |

### Design Implications

1. **Methods Library**
   - Planner should support a library of decomposition methods
   - Methods are optional (can plan without them)
   - Methods can dramatically improve plan quality/consistency

2. **Hierarchical Decomposition**
   - Compound tasks that expand into subtasks
   - Recursive decomposition until primitive steps
   - Matches our Step → sub-Steps model

3. **Hidden Formalism**
   - The paper shows formalism is valuable internally
   - But users don't need to see it
   - Validates our "HTN under the hood" approach

4. **Validation**
   - Can use HTN-style preconditions to validate plans
   - Detect impossible plans early
   - "Gap detection" for missing steps

### What We Should NOT Take

1. **Full PDDL complexity** - We're not building a PDDL planner
2. **Automated planning from goals** - Our plans are human/AI authored, not auto-generated
3. **State space search** - We don't search; we author

### What We SHOULD Take

1. **Method concept** - Reusable decomposition patterns
2. **Hierarchical structure** - Tasks that expand to subtasks
3. **Validation semantics** - Preconditions/effects for verification
4. **Optional formalism** - Use when helpful, hide from users

## Mapping to Planner Concepts

| HTN Concept | Planner Equivalent |
|-------------|-------------------|
| Task | Step |
| Compound Task | Step with sub-steps |
| Primitive Task | Leaf step (no sub-steps) |
| Method | Decomposition template |
| Precondition | Step prerequisites (implicit in dependencies) |
| Effect | Step acceptance criteria (what it produces) |
| Operator | Agent action |

## Example: How This Applies

**Without methods** (current approach):
```
Goal: "Implement dark mode"
→ Human/AI writes steps manually
→ No guidance on decomposition
```

**With methods** (enhanced approach):
```
Goal: "Implement dark mode"
→ System recognizes this matches "UI Feature" method
→ Method suggests decomposition:
   1. Research existing patterns
   2. Design approach
   3. Implement core
   4. Update components
   5. Test & validate
→ Human refines/customizes
→ Consistent, higher-quality plans
```

## Conclusion

This paper provides **academic validation** for our HTN-inspired approach while confirming we should:

1. Support hierarchical decomposition
2. Build a methods library
3. Keep formalism hidden from users
4. Use preconditions/effects for validation (not search)

The key insight: **HTN knowledge dramatically improves planning**, but we can use it for guidance and validation rather than automated search.

## References from Paper

- Bacchus and Kabanza, 2000: Using temporal logics for control knowledge
- Baier et al., 2007: Embedding HTN knowledge in classical planning
- Nau et al., 1999, 2003: SHOP/SHOP2 hierarchical planners
- Ghallab et al., 2004: Automated Planning (textbook)
- Wilkins, 1988: Practical Planning (foundational HTN work)
