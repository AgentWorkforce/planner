# Planner UX: User Scenarios

This document maps all user scenarios to inform UI/UX design decisions.

---

## 1. Creating a Plan

### 1.1 "I have a vague idea"

**Context**: User has loose thoughts, not structured.

**Entry**: Click [+ New] → type goal in natural language

**Flow**:
```
User types: "Add dark mode to the app"
           ↓
AI generates draft plan with steps
           ↓
User refines, edits, adds detail
```

**UX Need**: Single text input → immediate structure. No blank page.

---

### 1.2 "I have a PRD/spec document"

**Context**: User has existing document (markdown, notion, google doc).

**Entry**: Click [+ New] → "Import from document" → paste content

**Flow**:
```
User pastes PRD/spec text
           ↓
AI extracts goal, steps, acceptance criteria
           ↓
User reviews extracted structure
           ↓
Creates plan from extraction
```

**UX Need**: Paste-friendly. Show extraction preview before committing.

---

### 1.3 "I know exactly what I want"

**Context**: User wants full manual control, no AI help.

**Entry**: Click [+ New] → "Start blank" → manual entry

**Flow**:
```
User enters goal manually
           ↓
Adds steps one by one
           ↓
Sets dependencies, criteria manually
```

**UX Need**: Quick step entry. Keyboard shortcuts. No AI interruption.

---

### 1.4 "I want to use a template"

**Context**: Common patterns (feature rollout, bug fix, migration, incident response).

**Entry**: Click [+ New] → "From template" → select template

**Flow**:
```
User browses templates
           ↓
Selects one (e.g., "Feature Implementation")
           ↓
Template applied with placeholder steps
           ↓
User customizes for specific feature
```

**UX Need**: Template gallery. Preview before applying. Easy customization.

---

### 1.5 "Continue from existing plan"

**Context**: Similar to previous work. Clone and modify.

**Entry**: Open existing plan → [Duplicate] or from command palette

**Flow**:
```
User finds existing plan
           ↓
Duplicates as new draft
           ↓
Modifies for new context
```

**UX Need**: Easy duplicate. Clear that it's a new plan, not editing original.

---

## 2. Editing a Plan

### 2.1 "Edit my draft"

**Context**: Plan is in draft state, user is the author.

**Actions available**:
- Edit goal/context
- Add/remove/reorder steps
- Edit step details (title, description, owner, criteria)
- Set dependencies
- Add/remove gates

**UX Need**: Inline editing. Visual DAG for dependencies. Auto-save.

---

### 2.2 "Add a step I forgot"

**Context**: Need to insert a step, possibly in the middle of the DAG.

**Flow**:
```
Click [+ Add Step] or keyboard shortcut
           ↓
Position: "After step X" or "Before step Y" or "At end"
           ↓
AI suggests dependencies based on position
           ↓
User confirms or adjusts
```

**UX Need**: Contextual add (not just "at end"). Smart dependency suggestion.

---

### 2.3 "Remove a step"

**Context**: Step no longer needed.

**Flow**:
```
Select step → Delete
           ↓
If has dependents:
  "Step 3 depends on this. Redirect to: [Step 1] [None]"
           ↓
User chooses how to handle orphans
```

**UX Need**: Handle downstream gracefully. No orphan steps.

---

### 2.4 "Reorder/restructure dependencies"

**Context**: Change the flow of work.

**Flow**:
```
Option A: Drag step in DAG view
Option B: Edit step → change dependencies dropdown
Option C: Bulk edit in table view
```

**UX Need**: Visual drag for simple cases. Explicit edit for complex DAGs.

---

### 2.5 "Edit step details"

**Context**: Refine a specific step.

**Flow**:
```
Click step to expand/select
           ↓
Inline edit fields:
  - Title (always visible)
  - Description (expandable)
  - Owner role (dropdown)
  - Acceptance criteria (list)
  - Gate (toggle + settings)
           ↓
Auto-save on blur/change
```

**UX Need**: Inline editing. No modal for simple edits. Expand for details.

---

### 2.6 "I submitted but need to edit"

**Context**: Plan is submitted for review, but user realizes they need to change something.

**Flow**:
```
Plan shows "Submitted" badge
           ↓
User can still edit (submitted plans are editable)
           ↓
Edits auto-save, reviewers see latest
           ↓
OR: User clicks [Withdraw] to take back to working state
```

**UX Need**: Clear that editing is allowed. Option to formally withdraw.

---

## 3. Reviewing a Plan

### 3.1 "Review a plan submitted to me"

**Context**: User is a Portfolio manager or designated reviewer.

**Entry**: Inbox shows "Plans awaiting your review"

**Flow**:
```
Click plan in inbox
           ↓
See plan with review context:
  - Who submitted
  - When submitted
  - Any notes from author
           ↓
Actions: [Approve] [Request Changes] [Comment]
```

**UX Need**: Review context visible. Clear approval action.

---

### 3.2 "Add review comments"

**Context**: Reviewer wants to give feedback without approving/rejecting.

**Flow**:
```
Click on specific step
           ↓
Add comment (like PR review)
           ↓
Author sees comments, can respond
```

**UX Need**: Step-level comments. Thread support. Resolve mechanism.

---

### 3.3 "Request changes"

**Context**: Reviewer sees issues, wants author to fix before approval.

**Flow**:
```
Click [Request Changes]
           ↓
Add note explaining what needs fixing
           ↓
Plan stays in "submitted" but flagged
           ↓
Author notified, can edit and re-submit
```

**UX Need**: Clear feedback mechanism. Author knows what to fix.

---

## 4. Approval & Publishing

### 4.1 "Approve the plan"

**Context**: Reviewer satisfied, ready to sign off.

**Flow**:
```
Click [Approve]
           ↓
Confirmation: "This will lock the plan. Are you sure?"
           ↓
Plan transitions to "approved" (immutable)
           ↓
Author notified
```

**UX Need**: Clear this is irreversible for this version. Requires confirmation.

---

### 4.2 "Publish to orchestrator"

**Context**: Approved plan ready for execution.

**Flow**:
```
Plan is "approved"
           ↓
Click [Publish]
           ↓
"This will release the plan for execution. Continue?"
           ↓
Plan transitions to "published"
           ↓
plan_ref available for orchestrator
```

**UX Need**: Clear this is the "go" signal. Show what happens next.

---

## 5. During Execution

### 5.1 "View execution progress"

**Context**: Plan is published, orchestrator is running it.

**Entry**: Open plan → see execution overlay

**View**:
```
Plan steps with execution status:
  ✅ Step 1: Done (2h ago)
  ✅ Step 2: Done (1h ago) - gate approved by @alice
  🔄 Step 3: Running (started 30m ago)
  ⏸️ Step 4: Waiting on Step 3
  ⏸️ Step 5: Waiting on Steps 3, 4
```

**UX Need**: Real-time status. Clear blocking relationships. Time info.

---

### 5.2 "Orchestrator needs plan change"

**Context**: During execution, orchestrator discovers plan is incomplete.

**Entry**: Inbox shows "Change request for [Plan Name]"

**Flow**:
```
Orchestrator submits change request:
  "Missing database migration step"
           ↓
User reviews change request
           ↓
Options:
  [Accept] - creates new version with suggested changes
  [Modify] - edit then accept
  [Reject] - decline with reason
```

**UX Need**: Clear what orchestrator is asking for. Easy to accept/modify.

---

### 5.3 "Approve a gate during execution"

**Context**: Plan has a human approval gate, execution paused.

**Entry**: Inbox shows "Gate approval needed for [Plan Name]"

**Flow**:
```
Click to see gate context:
  - Which step needs approval
  - What was the output of previous step
  - Who is asking
           ↓
[Approve Gate] or [Reject Gate]
```

**UX Need**: Enough context to make decision. Quick action.

---

## 6. Version History

### 6.1 "View previous versions"

**Context**: Want to see how plan evolved.

**Entry**: Open plan → [History] or version dropdown

**View**:
```
Version list:
  v3 (current) - approved - 2h ago
  v2 - superseded - 1d ago
  v1 - superseded - 3d ago
```

**UX Need**: Clear version timeline. Status of each version.

---

### 6.2 "Compare versions"

**Context**: What changed between versions?

**Flow**:
```
Select two versions to compare
           ↓
Diff view:
  + Step added
  ~ Step modified (show field changes)
  - Step removed
```

**UX Need**: Structural diff, not text diff. Field-level changes.

---

### 6.3 "Restore previous version"

**Context**: Want to go back to an earlier version.

**Flow**:
```
View old version
           ↓
[Restore as new draft]
           ↓
Creates new draft version with old content
           ↓
User can modify and submit
```

**UX Need**: Non-destructive restore (creates new version, doesn't overwrite).

---

## 7. Finding Plans

### 7.1 "See all my plans"

**Context**: Browse/filter plans.

**Entry**: Inbox "Recent" section or dedicated [All Plans] view

**Filters**:
- Status: draft, submitted, approved, published
- Tags: backend, frontend, infrastructure
- Date range
- Search text

**UX Need**: Fast filtering. Remember last filter settings.

---

### 7.2 "Find a specific plan"

**Context**: Know what looking for, want to jump there.

**Entry**: ⌘K command palette

**Flow**:
```
⌘K → type plan name or keyword
           ↓
Results show matching plans
           ↓
Enter to open
```

**UX Need**: Fast search. Recent items. Fuzzy matching.

---

### 7.3 "Archive/delete a plan"

**Context**: Plan no longer needed.

**Flow**:
```
Plan menu → [Archive]
           ↓
Plan moves to archive (soft delete)
           ↓
Can restore from archive if needed
```

**UX Need**: Soft delete by default. Archive view for recovery.

---

## 8. AI Assistance

### 8.1 "Help me improve this plan"

**Context**: Want AI advice on current plan.

**Entry**: [AI Chat] button or ⌘/

**Flow**:
```
Open AI chat panel
           ↓
"Can you review step 3 and suggest acceptance criteria?"
           ↓
AI responds with suggestions
           ↓
[Apply] to add suggestions to plan
```

**UX Need**: Contextual chat (AI knows current plan). Easy apply.

---

### 8.2 "AI auto-improved things"

**Context**: AI made silent improvements while user was working.

**Indicator**:
```
Subtle badge: "3 improvements" (expandable)
           ↓
Click to see:
  • Added acceptance criteria to step 3
  • Fixed dependency on step 5
  • Clarified description of step 7
           ↓
[Undo All] if user disagrees
```

**UX Need**: Non-intrusive notification. Easy undo. Don't interrupt flow.

---

### 8.3 "AI flagged an issue"

**Context**: AI found something that needs human decision.

**Indicator**:
```
Inline flag on affected step:
  ⚠️ "Steps 4 and 6 seem to overlap"
           ↓
Click to see options:
  [Merge Steps] [Keep Separate] [Ask AI to explain]
```

**UX Need**: Inline, not modal. Context preserved. Clear options.

---

## 9. Collaboration

### 9.1 "Share plan with someone"

**Context**: Need others to view or collaborate.

**Flow**:
```
Plan menu → [Share]
           ↓
Options:
  - Copy link (view only)
  - Add collaborator (email) with role (view/edit/approve)
```

**UX Need**: Simple sharing. Clear permission model.

---

### 9.2 "See who did what"

**Context**: Audit trail, understand history.

**Entry**: Plan → [Activity] panel

**View**:
```
Activity timeline:
  • 5m ago: AI added criteria to step 3
  • 1h ago: @bob edited step 2
  • 2h ago: @alice submitted for review
  • 1d ago: @alice created plan
```

**UX Need**: Full attribution. Filter by person/action type.

---

## Summary: Primary UX Patterns

Based on these scenarios, the UI should support:

### 1. Multiple Creation Paths
- Quick: Goal text → AI draft
- Import: Paste PRD → extract
- Template: Select → customize
- Clone: Duplicate → modify
- Manual: Blank → build

### 2. Inline Editing Everywhere
- No modals for simple edits
- Click to edit, blur to save
- Expand for complex fields

### 3. Non-Destructive Everything
- All changes create versions
- Soft delete (archive)
- Easy restore/undo

### 4. Progressive Disclosure
- Simple view by default (title, status)
- Expand for details
- Power features in menus/palette

### 5. Keyboard-First
- ⌘K for everything
- Shortcuts for common actions
- Arrow navigation

### 6. AI as Background Helper
- Works silently
- Surfaces only decisions
- Chat when needed

### 7. Clear State Indicators
- Always know: draft/submitted/approved/published
- Always know: who owns next action
- Always know: what's blocking
