# Planner-UI Building Blocks - Complete Documentation Index

**Generated**: February 6, 2026
**Total Size**: 114 KB across 5 documents

---

## 📖 Documentation Files

### 1. **PLANNER-UI-QUICK-START.md** (17 KB) ⭐ START HERE
Visual quick reference with diagrams and component hierarchy
- Three-column model diagram
- Quick component map (click-by-feature)
- Hook usage by feature
- Column assignments summary
- Critical patterns highlighted
- **Read this first**: 5-10 minutes for quick overview

**Best for**:
- "I need to find component X quickly"
- "How does this feature work visually?"
- "Show me the three-column layout"

---

### 2. **PLANNER-UI-MAPREAD-ME.md** (15 KB) ⭐ ENTRY POINT
Comprehensive guide with strategic insights
- Quick navigation by use case ("I need a component for...")
- Key architectural decisions explained
- Three-column mapping with examples
- Recommended reuse strategy for "tend"
- Component reuse matrix (which to take as-is, adapt, or learn from)
- File reading order + questions to answer before reusing
- Integration checklist

**Read this second**: 10-15 minutes for strategic understanding

**Best for**:
- "How should we approach reusing planner-ui?"
- "Which components can we use as-is?"
- "What's the overall architecture?"

---

### 3. **planner-ui-building-blocks.md** (34 KB) 📚 COMPREHENSIVE CATALOG
Complete inventory of every component and its properties
- 150+ components organized by feature area
- For each: file path, description, dependencies, column assignment
- Feature areas:
  - Layout & Navigation
  - Status Bar & Agent Presence
  - Chat & Questions
  - Right Sidebar Messaging
  - Plan Editor (comprehensive)
  - Step Editing (all components)
  - Step Visualization (swimlane, SVG overlay)
  - Plan/Initiative Listings
  - Attention & Alerts
  - Real-Time Communication (relay section)
  - Agent Orchestration & Questions (comprehensive)
  - Command Palette & Search
  - State Management Hooks
  - API & Data Fetching
  - UI Components (shared)
  - Custom Icons
  - Utilities & Helpers
  - Configuration
  - Pages/Routes
  - State Management Patterns
  - CSS/Styling System
  - Performance Considerations
  - Known Limitations / Future Improvements

**Use as**:
- Reference guide (search for component name)
- Dependencies checker (what does this need?)
- Feature completeness review (what components exist for this feature?)

**Read this for details**: As needed (use search/grep)

---

### 4. **planner-ui-architecture.md** (29 KB) 🏗️ DEEP DIVES
Component tree and data flow diagrams
- Full component tree (ASCII art)
  - App root structure
  - PlansListPage tree
  - PlanEditorPage tree (all tabs)
  - InitiativesListPage
  - PipelinePage
  - ChannelPage
- Data flow diagrams:
  - Plan editing (inline edit → API → SSE → refetch)
  - Chat & questions (useQuestionQueue → useQuestionNotifications → TriagePanel → ChatBubble)
  - Relay & messaging (WebSocket lifecycle → message flow)
  - Real-time sync (SSE + debounce pattern)
  - State persistence (localStorage, URL params, context, memory)
  - Swimlane visualization (topological sort → dependency lines)
  - Command palette (keyboard → fuzzy search → navigate)
  - Attention item selection (priority grouping → click → navigate)
  - Message input & send flow
  - Agent click flow (needs_input vs. idle state)
- Key data shapes (Step, Question, Agent, RelayMessage)

**Use as**:
- Understanding data flow ("How does X get updated?")
- Integration planning ("Where does my data come from?")
- Real-time sync strategy ("How do we keep data in sync?")

**Read this**: For feature-specific data flows

---

### 5. **planner-ui-hooks-reference.md** (19 KB) 🪝 HOOK GUIDE
All 38+ custom hooks with signatures and examples
- Grouped by category:
  - Core Context Hooks (useRelay, usePlanEditor, useToast)
  - Real-Time & Messaging (useRelayConnection, useChannels, etc.)
  - Questions & Orchestration (useQuestionQueue, useAgentOrchestration)
  - State Management (usePlansViewMode, useSidebarState, useTheme, etc.)
  - Data Fetching (useInitiatives, usePlanEvents, etc.)
  - Visualization (useTopologicalSort, useDependencyPositions)
  - Utility (useUserTrajectory, use-mobile)
- For each hook:
  - File path
  - Dependencies
  - Full signature with return types
  - Usage examples
  - Notes on behavior
- Hook dependency graph (visual)
- Common patterns explained with code
- Testing patterns (vitest examples)

**Use as**:
- Hook API reference ("What does this hook return?")
- Integration guide ("How do I use this hook?")
- Pattern reference ("How do I implement X pattern?")

**Read this**: When implementing specific features

---

## 🎯 Reading Guide by Role

### Product Manager / Architect
1. **PLANNER-UI-QUICK-START.md** - Understand layout & components
2. **PLANNER-UI-MAPREAD-ME.md** - Strategic reuse recommendations
3. **planner-ui-architecture.md** - Key architectural patterns

**Time**: 30 minutes

### Frontend Developer (Reusing Components)
1. **PLANNER-UI-QUICK-START.md** - Find the component you need
2. **PLANNER-UI-MAPREAD-ME.md** - Assess reuse strategy
3. **planner-ui-building-blocks.md** - Get file path & dependencies
4. **planner-ui-hooks-reference.md** - Look up hook signatures as needed
5. **Actual component files** - Read the implementation

**Time**: 1-2 hours per feature

### Integration Engineer
1. **PLANNER-UI-MAPREAD-ME.md** - Integration checklist & critical patterns
2. **planner-ui-architecture.md** - Data flow for your feature
3. **planner-ui-hooks-reference.md** - Hook setup & usage
4. **planner-ui-building-blocks.md** - Component APIs

**Time**: 2-4 hours for full integration

### QA / Tester
1. **PLANNER-UI-QUICK-START.md** - Understand UI structure
2. **planner-ui-building-blocks.md** - Find components being tested
3. Feature-specific data flow in **planner-ui-architecture.md**

**Time**: 30 minutes per feature

---

## 🔍 How to Find Things

**I need to find a component...**
- Search **planner-ui-quick-start.md** for visual hierarchy
- Grep **planner-ui-building-blocks.md** for "ComponentName"
- Look at file paths: `/packages/planner-ui/src/components/...`

**I need to understand how a feature works...**
- Find the flow in **planner-ui-architecture.md** data flow section
- Look up hooks in **planner-ui-hooks-reference.md**
- Check components in **planner-ui-building-blocks.md** for dependencies

**I want to know if I can reuse a component...**
- Check **PLANNER-UI-MAPREAD-ME.md** reuse matrix
- Look at "dependencies" section in **planner-ui-building-blocks.md**
- Check if dependencies exist in your codebase

**I need to integrate a feature...**
- Follow integration checklist in **PLANNER-UI-MAPREAD-ME.md**
- Study data flow in **planner-ui-architecture.md**
- Use hook signatures from **planner-ui-hooks-reference.md**

**I need to implement a pattern...**
- Look up pattern in **PLANNER-UI-MAPREAD-ME.md** key decisions
- Find code example in **planner-ui-hooks-reference.md** common patterns
- Check actual implementation in `/packages/planner-ui/src/`

---

## 🔑 Key Numbers

- **Components**: 150+
- **Hooks**: 38+
- **Pages**: 7
- **API endpoints used**: 15+
- **Contexts**: 3 (RelayProvider, PlanEditorProvider, ToastProvider)
- **Lines of code analyzed**: 6,500+
- **Documentation generated**: 114 KB

---

## ✅ Critical Components (Don't Skip)

1. **RelayProvider** - Single shared WebSocket (MUST use!)
2. **PlanEditorContext** - Plan editing state management
3. **useRelayConnection** - WebSocket lifecycle
4. **EditableText / EditableTextarea** - Inline editing pattern
5. **StepEditor** - Step card with all fields
6. **SwimlaneView** - Dependency visualization
7. **useQuestionQueue** - Question polling
8. **useQuestionNotifications** - Notification bubble queue

---

## ⚠️ Critical Patterns (Don't Forget)

1. **Single WebSocket**: RelayProvider at app root, all components use useRelay()
2. **SSE + Debounce**: 250ms debounce on refetch to batch updates
3. **Inline Editing**: Click to edit, Enter to save, Escape to cancel, optimistic update
4. **localStorage Persistence**: Save UI state across page reload
5. **Event Cleanup**: Unsubscribe from all subscriptions on unmount
6. **URL Params**: Use for sharable, browser-navigable state
7. **Component Nesting**: Keep nesting depth at 3 levels max

---

## 🚀 Quick Start for "Tend" Integration

### Phase 1: Understand (1 hour)
- [ ] Read PLANNER-UI-QUICK-START.md
- [ ] Review PLANNER-UI-MAPREAD-ME.md
- [ ] Skim planner-ui-architecture.md

### Phase 2: Extract (2 hours)
- [ ] Copy RelayContext as-is
- [ ] Copy all relay hooks (useRelay, useChannels, etc.)
- [ ] Copy form controls (Badge, Button, Input, etc.)
- [ ] Copy icon set
- [ ] Test isolated components

### Phase 3: Adapt (4 hours)
- [ ] Copy Layout.tsx, adapt for 3-column
- [ ] Copy AppSidebar structure
- [ ] Copy StepEditor pieces
- [ ] Adapt messaging sidebar

### Phase 4: Integrate (6 hours)
- [ ] Copy useQuestionQueue pattern
- [ ] Implement LEFT column (attention + questions)
- [ ] Implement CENTER column (messaging via relay)
- [ ] Implement RIGHT column (plan view)
- [ ] Connect all pieces

### Phase 5: Test (2 hours)
- [ ] Test WebSocket reconnection
- [ ] Test real-time message flow
- [ ] Test question routing
- [ ] Performance testing

---

## 🎓 Learning Resources

**For WebSocket patterns**: Check useRelayConnection.ts in hooks/
**For real-time sync**: See PlanEditorContext's SSE + debounce
**For inline editing**: Study EditableText.tsx
**For swimlane visualization**: Check SwimlaneView.tsx + DependencyLinesOverlay.tsx
**For state persistence**: Look at usePlansViewMode.ts
**For API integration**: Review api/ directory

---

## 📞 Questions Answered by These Docs

- ✅ "What components exist in planner-ui?"
- ✅ "How do I reuse them in tend?"
- ✅ "What are the dependencies?"
- ✅ "How does real-time sync work?"
- ✅ "How does the WebSocket connection work?"
- ✅ "How do I implement inline editing?"
- ✅ "What's the question routing flow?"
- ✅ "How are steps visualized?"
- ✅ "What's the three-column architecture?"
- ✅ "Which components should I take as-is vs. adapt?"
- ✅ "How do I persist state?"
- ✅ "What's the hook dependency graph?"
- ✅ "How do I set up the RelayProvider?"

---

## 🔗 File Locations

All files are in `/Users/flysikring/conductor/workspaces/plannr/auckland/docs/`:

```
docs/
├── PLANNER-UI-QUICK-START.md              (17 KB) ⭐
├── PLANNER-UI-MAPREAD-ME.md               (15 KB) ⭐
├── planner-ui-architecture.md             (29 KB) 🏗️
├── planner-ui-building-blocks.md          (34 KB) 📚
├── planner-ui-hooks-reference.md          (19 KB) 🪝
└── INDEX-PLANNER-UI-MAPS.md              (this file)
```

Source code: `/Users/flysikring/conductor/workspaces/plannr/auckland/packages/planner-ui/src/`

---

## ✨ Summary

You now have **five comprehensive documents** that provide:

1. **Quick visual reference** (PLANNER-UI-QUICK-START.md)
2. **Strategic guidance** (PLANNER-UI-MAPREAD-ME.md)
3. **Complete inventory** (planner-ui-building-blocks.md)
4. **Data flow deep dives** (planner-ui-architecture.md)
5. **Hook API reference** (planner-ui-hooks-reference.md)

**Total coverage**: 150+ components, 38+ hooks, all architectural patterns, all data flows, all integration guidance.

**Ready to start**: Pick your role above, follow the reading guide, and start building!

