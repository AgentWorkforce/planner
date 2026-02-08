# Ideation-UI Building Blocks Documentation

Comprehensive guide to ideation-ui architecture, components, and patterns for planning the "tend" unified app.

## Documents in This Series

### 1. **ideation-ui-components-map.md** (Primary Reference)
Complete inventory of all 80+ components, hooks, and utilities with:
- File paths and descriptions
- Dependencies and props
- Column assignment (LEFT/CENTER/RIGHT/STATUS/LAYOUT)
- State management patterns
- Animation systems
- API integrations

**Start here** to understand what exists and where it lives.

### 2. **ideation-ui-tend-migration-notes.md** (Practical Guide)
Actionable guidance for adapting ideation-ui patterns to "tend":
- Quick navigation map (visual grid zones)
- Core systems to reuse (physics, SSE, chat, focus mode)
- State management best practices
- Dashboard multi-session patterns
- CSS variables and theming
- Migration checklist
- Open design questions

**Use this** when planning specific "tend" features.

### 3. **ideation-ui-architecture.md** (Technical Deep Dive)
System design and implementation patterns:
- High-level component tree
- Data flow diagrams
- Physics engine integration
- State management strategies (URL, localStorage, server)
- CSS architecture (variables, Tailwind, responsive)
- Performance optimizations
- Error handling patterns
- File organization and testing

**Reference this** when implementing complex features.

---

## Quick Start: Finding Components

### By Location in UI

#### Header (SessionNav)
- **File**: `components/canvas/CanvasHeader.tsx`
- **Props**: sessionId, sessionTitle, sessions, actions
- **Features**: Title editing, session dropdown, confidence bar, action buttons

#### LEFT Column: Forming Blocks
- **Container**: `components/canvas/FormingBlocksColumn.tsx`
- **Block Renderer**: `components/canvas/PhysicsBlock.tsx`
- **Base**: `components/shared/PhysicsBlockBase.tsx`
- **Physics Hook**: `hooks/usePhysicsEngine.ts`
- **Desktop**: Matter.js physics simulation (central attraction)
- **Mobile**: Static list (performance)

#### CENTER Column: Chat
- **Container**: `components/chat/SessionChatView.tsx`
- **Input**: `components/chat/ChatInput.tsx`
- **Messages**: `components/chat/ChatMessageList.tsx` + `ChatBubble.tsx`
- **Typing**: `components/chat/TypingIndicator.tsx`
- **Focus Mode**: `components/canvas/FocusMode.tsx` (wraps chat with detail panel)

#### RIGHT Column: Curated Blocks
- **Container**: `components/canvas/CuratedBlocksColumn.tsx`
- **Card**: Individual curated block card
- **Styling**: Green left border, curated background color
- **Action**: Uncurate button (move back to forming)

#### Status Bar
- **Component**: `components/canvas/IdeationStatusBar.tsx`
- **Data**: Agent status indicators
- **Source**: `@plannr/shared-ui/StatusBar` wrapper

### By Hook/Feature

| Hook | Purpose | File |
|------|---------|------|
| `usePhysicsEngine` | Matter.js + attraction forces | `hooks/usePhysicsEngine.ts` |
| `useBlocks` | Fetch + SSE blocks + mutations | `hooks/useBlocks.ts` |
| `useSession` | Fetch session metadata | `hooks/useSession.ts` |
| `useSessions` | Fetch all sessions (sorted) | `hooks/useSessions.ts` |
| `useSessionEvents` | SSE subscription for events | `hooks/useSessionEvents.ts` |
| `useSendMessage` | Send message with optional block context | `hooks/useSendMessage.ts` |
| `useUnderstanding` | Fetch + SSE specialist understanding | `hooks/useUnderstanding.ts` |
| `useConfidence` | Calculate confidence scores | `hooks/useConfidence.ts` |
| `usePanelState` | Right panel collapse state (localStorage) | `hooks/usePanelState.ts` |
| `useMediaQuery` | Detect mobile breakpoint | `hooks/useMediaQuery.ts` |
| `useCommandPalette` | Command palette state | `hooks/useCommandPalette.ts` |
| `useToast` | Toast notifications | `hooks/useToast.ts` |
| `useTheme` | Theme switching | `hooks/useTheme.ts` |

---

## Core Concepts

### 1. Block Confidence → Size Progression
Blocks reveal content as confidence increases:

```
0-30%:   forming     → 20px dot (no content)
30-60%:  emerging    → 40-60px (emoji only)
60-90%:  developing  → 60-80px (emoji + keyword)
90-100%: ready       → 80-100px (full + glow)
curated: -           → right column (stable)
```

### 2. Physics Simulation
Matter.js with custom forces:
- **Central attraction** (0.00008): gentle drift to center
- **Initiative grouping** (0.00015): stronger, creates clusters
- **Edge attraction** (0.00012): for abandoned sessions
- **Collision detection**: circles don't overlap
- **Wall boundaries**: containment at container edges

### 3. Real-time Updates (SSE)
```
CanvasPage
  ├─ useBlocks → SSE: /api/ideation/sessions/{id}/events
  │   └─ Event: session:block_created/updated/deleted
  ├─ useSessionEvents → SSE: same endpoint
  │   └─ Events: transcript, status, understanding, blocks
  └─ useUnderstanding → SSE: same endpoint
      └─ Event: session:understanding_updated
```

### 4. Focus Mode Transition
URL-based state sync:
```
/ideation/session/:id           → Normal 3-column (100% | 0% visible)
/ideation/session/:id?block=:id → FocusMode 2-column (60% | 40%)
```

---

## State Management Quick Reference

### URL State (Navigation)
```typescript
// Read
const { id } = useParams<{ id: string }>();
const blockId = searchParams.get('block');

// Write
navigate(`/ideation/session/${sessionId}`);
setSearchParams({ block: blockId });
```

### LocalStorage State (UI Prefs)
```typescript
const { isCollapsed, togglePanel } = usePanelState();
// Persists to localStorage['ideation-panel-collapsed']
```

### Server State (Data)
```typescript
const { blocks, loading, error, curateBlock } = useBlocks(sessionId);
// Fetch + SSE subscribe + mutations
```

---

## Common Patterns

### Pattern 1: Fetch + SSE Subscribe (Recommended for Real-Time Data)
```typescript
// In useBlocks hook
useEffect(() => {
  fetchBlocks(); // Initial fetch

  const eventSource = new EventSource(url);
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.blocks) setBlocks(data.blocks); // SSE provides new state
  };

  return () => eventSource.close();
}, [sessionId]);
```

**For Tend**: Reuse this pattern for "tend" blocks and other real-time data.

### Pattern 2: Focus Mode with Detail Panel
```typescript
// FocusMode wraps chat view
focusedBlock ? (
  <FocusMode block={focusedBlock} onClose={...}>
    <SessionChatView sessionId={id} focusedBlockId={focusedBlock.id} />
  </FocusMode>
) : (
  <SessionChatView sessionId={id} />
)
```

**For Tend**: Perfect pattern for "tend" detail view + chat sidebar.

### Pattern 3: Physics Body Sync
```typescript
useEffect(() => {
  filteredBlocks.forEach((block) => {
    if (!physicsIds.has(block.id)) {
      addBody({ id: block.id, radius: getBlockSize(block.confidence) });
    }
  });
}, [filteredBlocks, isReady]);

// PhysicsBlockBase does the DOM sync
```

**For Tend**: Same pattern for syncing "tend" blocks with physics.

### Pattern 4: Confidence-Based Rendering
```typescript
const visibilityLevel = getVisibilityLevel(block.confidence); // 'forming' | 'emerging' | ...
const showKeyword = shouldShowKeyword(confidence, size);
const showGlow = shouldShowGlow(confidence);

// Render conditionally
{visibilityLevel !== 'forming' && <span>{emoji}</span>}
{showKeyword && <span>{keyword}</span>}
{showGlow && <div className="animate-pulse" />}
```

**For Tend**: Adapt with "tend" block type system.

---

## Component Reusability Score

### Highly Reusable (80-90%)
- `PhysicsBlockBase` — core physics-to-DOM sync
- `ChatInput`, `ChatMessageList`, `ChatBubble` — chat UI
- `IdeationGridLayout` — 3-column grid pattern
- `FocusMode` — detail + sidebar pattern
- `usePhysicsEngine` — Matter.js wrapper
- `PhysicsBlock` — just add "tend" confidence styling

### Moderately Reusable (60-80%)
- `SessionNav` — adapt header for "tend" (keep breadcrumbs, change actions)
- `CuratedBlocksColumn` — reuse layout, change styling
- `SpecialistsPanel` → Expert/Advisor panel (rename, adapt data)
- Block visibility utilities → adapt confidence thresholds

### Low Reusability (40-60%)
- `SessionDashboard` — specific to multi-session ideation
- `NavigatorChat` — specific to ideation domain
- Dashboard physics (`SessionsPhysicsBlock`, `SessionsPhysicsColumn`)

### Domain-Specific (Rewrite for "Tend")
- `useBlocks` → `useTendBlocks` (adapt endpoints)
- `useSession` → `useTendSession`
- `useSessionEvents` → `useTendEvents` (adapt event types)
- Chat message payload structure

---

## Architecture Decision Records

### 1. Why usePhysicsEngine instead of gesture/animation libraries?
**Decision**: Matter.js for realistic physics.
- **Reasoning**: Requires collision detection + multiple attraction forces
- **Tradeoff**: Adds ~30KB (gzipped), disables on mobile
- **For Tend**: Keep if visual appeal > performance concerns; otherwise use Framer Motion

### 2. Why SSE instead of WebSocket?
**Decision**: Server-Sent Events for unidirectional push.
- **Reasoning**: Simpler, HTTP-based, auto-reconnect, subscriptable per-hook
- **Tradeoff**: Unidirectional; full-duplex needs fallback for posting
- **For Tend**: Same choice unless chat needs lower latency

### 3. Why localStorage for UI state, not Context?
**Decision**: localStorage for user preferences.
- **Reasoning**: Survives page refresh, no context wrapper needed
- **Tradeoff**: Synchronization with other tabs (not handled)
- **For Tend**: Keep same pattern for settings, settings panel

### 4. Why three separate SSE subscriptions (useBlocks, useSessionEvents, useUnderstanding)?
**Decision**: Multiple independent subscriptions.
- **Reasoning**: Decoupled concerns, each hook manages its data
- **Tradeoff**: Multiple EventSource instances (three at max)
- **For Tend**: Consider consolidating if becoming unwieldy

---

## Common Pitfalls to Avoid

### 1. Double Renders in StrictMode
**Problem**: Physics bodies added twice, causing duplicates.
**Solution** (already in code):
```typescript
if (bodyMapRef.current.has(options.id)) {
  return; // Skip if body exists
}
```

### 2. Infinite Effect Loops
**Problem**: Dependency array includes unstable reference.
**Solution**:
```typescript
const getSessionRef = useRef(getSessions);
getSessionRef.current = getSessions;

useEffect(() => {
  fetchSessions();
}, [fetchSessions]); // Stable reference via ref
```

### 3. Stale Closures in Event Handlers
**Problem**: Handler uses old state from closure.
**Solution**:
```typescript
const updatePosition = () => {
  const left = position.x - size / 2; // Fresh position from render
  element.style.transform = `translate(${left}px, ...)`;
  animationFrameRef.current = requestAnimationFrame(updatePosition);
};
```

### 4. Z-Index Stacking Issues
**Problem**: z-index alone doesn't work without positioning parent.
**Solution** (in PhysicsBlockBase):
```css
position: absolute;
z-index: ${activityScore};
```

### 5. Physics Body Bounds Not Accurate
**Problem**: getBoundingClientRect() called before DOM layout.
**Solution** (comment in IdeationGridLayout):
```
CRITICAL: All grid cells maintain real dimensions so
physics engine can call getBoundingClientRect() reliably.
```

---

## Testing Strategy

### Unit Tests
```typescript
// blockVisibility.test.ts
describe('getVisibilityLevel', () => {
  it('returns forming for 0-30%', () => {
    expect(getVisibilityLevel(15)).toBe('forming');
  });
  it('returns ready for 90-100%', () => {
    expect(getVisibilityLevel(95)).toBe('ready');
  });
});
```

### Component Tests
```typescript
// PhysicsBlock.test.tsx
describe('PhysicsBlock', () => {
  it('shows emoji for emerging+ blocks', () => {
    const { getByText } = render(
      <PhysicsBlock block={{ confidence: 50, status: 'emerging' }} />
    );
    expect(getByText('💡')).toBeInTheDocument();
  });
});
```

### Hook Tests
```typescript
// useBlocks.test.ts
describe('useBlocks', () => {
  it('fetches blocks on mount', async () => {
    const { result } = renderHook(() => useBlocks('session-1'));
    expect(result.current.loading).toBe(true);
    // ... wait for async
  });
});
```

---

## Performance Checklist

- [x] Physics disabled on mobile (useIsMobile)
- [x] GPU acceleration with `will-change: transform`
- [x] RAF loop for 60fps DOM sync
- [x] Map data structure for O(1) physics body lookup
- [x] Exponential backoff for SSE reconnect
- [x] Memoization in hooks (useCallback, useRef)
- [x] CSS Grid (efficient layout)
- [x] Event delegation for click handlers
- [ ] Lazy load images/icons (could add)
- [ ] Virtual scrolling for large message lists (could add)

---

## Next Steps for "Tend"

1. **Study the maps**: Understand component tree and data flow
2. **Set up structure**: Create `packages/tend-ui` mirroring ideation-ui
3. **Copy base components**: PhysicsBlockBase, PhysicsBlock, Chat components
4. **Adapt hooks**: Create `useTend*` versions targeting "tend" API
5. **Define "tend" data models**: Blocks, confidence, states
6. **Implement layout**: IdeationGridLayout (reuse)
7. **Wire up chat**: Reuse chat components, adapt message structure
8. **Add physics**: usePhysicsEngine (reuse)
9. **Test**: Vitest + RTL (same setup)
10. **Theme**: Adapt CSS variables for "tend" colors

---

## Reference Files

**All files referenced in maps**:
- Complete inventory: `ideation-ui-components-map.md` (80+ components)
- Code paths: Absolute paths like `/packages/ideation-ui/src/components/...`
- Hooks summary: Table with purpose + file path

**For quick lookups**:
- Search "File:" in components-map.md for path
- Search component name in architecture.md for system context
- Search pattern name in migration-notes.md for usage guidance

---

## Questions?

Refer to the appropriate document:
- **"Where is component X?"** → components-map.md (search by name)
- **"How do I use pattern Y?"** → architecture.md (search by pattern)
- **"How do I adapt this for Tend?"** → migration-notes.md (search by feature)

---

**Generated**: February 2026
**Scope**: Ideation-UI complete inventory
**Purpose**: Planning "Tend" app reuse and adaptation

**Read the full maps**:
- `/docs/ideation-ui-components-map.md`
- `/docs/ideation-ui-tend-migration-notes.md`
- `/docs/ideation-ui-architecture.md`
