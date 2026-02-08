# Ideation-UI Architecture Overview

## High-Level Component Tree

```
App.tsx (routing root)
├── Routes
│   ├── /ideation (dashboard)
│   │   └── DashboardPage
│   │       └── SessionDashboard
│   │           └── IdeationGridLayout
│   │               ├── DashboardNav (nav)
│   │               ├── SessionsPhysicsColumn (left)
│   │               │   └── SessionPhysicsBlock × N
│   │               │       └── PhysicsBlockBase
│   │               ├── NavigatorChat (center)
│   │               ├── SentToPlannerColumn (right)
│   │               └── IdeationStatusBar (status)
│   │
│   ├── /ideation/session/:id (canvas)
│   │   └── CanvasPage
│   │       └── IdeationGridLayout
│   │           ├── SessionNav (nav)
│   │           ├── FormingBlocksColumn (left)
│   │           │   └── PhysicsBlock × N
│   │           │       └── PhysicsBlockBase
│   │           ├── SessionChatView or FocusMode (center)
│   │           │   ├── ChatMessageList
│   │           │   │   └── ChatBubble × N
│   │           │   ├── ChatInput
│   │           │   └── TypingIndicator
│   │           ├── CuratedBlocksColumn (right)
│   │           │   └── CuratedBlockCard × N
│   │           └── IdeationStatusBar (status)
│   │
│   └── /mockup (development)
│       └── MockupPage
│
└── Overlays (global, outside routing)
    ├── CommandPalette
    ├── Toaster (toast notifications)
    └── (FocusMode, AIUnderstandingDrawer, HandoffDialog mounted in CanvasPage)
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Server                               │
│  (/api/ideation/sessions, /api/ideation/sessions/{id}/events)  │
└────────┬────────────────────────────┬────────────────────────────┘
         │ GET /sessions                │ EventSource
         │ GET /sessions/{id}           │ /events
         │ PATCH /sessions/{id}         │
         │ POST /send-to-planner        │
         ▼                              ▼
    ┌─────────────────────────────────────────┐
    │        Custom React Hooks                │
    │  (useBlocks, useSession, etc.)          │
    │                                          │
    │  useBlocks                              │
    │  ├─ blocks: Block[]                     │
    │  ├─ curateBlock(id)                     │
    │  ├─ uncurateBlock(id)                   │
    │  ├─ updateBlock(id, updates)            │
    │  └─ SSE subscription (auto-sync)        │
    │                                          │
    │  useSession                             │
    │  ├─ session: Session                    │
    │  ├─ loading, error                      │
    │  └─ refetch()                           │
    │                                          │
    │  useSessionEvents                       │
    │  ├─ transcript updates                  │
    │  ├─ status changes                      │
    │  ├─ understanding updates               │
    │  └─ block updates                       │
    │                                          │
    │  useSendMessage                         │
    │  └─ send(content) → POST /messages      │
    │                                          │
    │  useUnderstanding                       │
    │  ├─ understanding data                  │
    │  ├─ activeSpecialists                   │
    │  └─ SSE subscription                    │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │      Component State                     │
    │  (React hooks + URL params)              │
    │                                          │
    │  FormingBlocksColumn                    │
    │  ├─ blocks from useBlocks               │
    │  └─ physics bodies from usePhysicsEngine│
    │                                          │
    │  CuratedBlocksColumn                    │
    │  └─ blocks from useBlocks (filtered)    │
    │                                          │
    │  SessionChatView                        │
    │  ├─ transcript from useSessionEvents    │
    │  ├─ focusedBlockId from URL             │
    │  └─ send handler from useSendMessage    │
    │                                          │
    │  FocusMode                              │
    │  ├─ focusedBlockId from URL             │
    │  ├─ focusedBlock from blocks array      │
    │  └─ updateBlock handler                 │
    │                                          │
    │  SpecialistsPanel                       │
    │  ├─ understanding from useUnderstanding │
    │  └─ activeSpecialists                   │
    │                                          │
    │  CanvasPage                             │
    │  ├─ focusedBlockId (local state + URL) │
    │  ├─ isUnderstandingDrawerOpen           │
    │  └─ isHandoffDialogOpen                 │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │      DOM Rendering                      │
    │                                          │
    │  IdeationGridLayout (CSS Grid)          │
    │  ├─ nav area: SessionNav                │
    │  ├─ left area: FormingBlocksColumn      │
    │  ├─ center area: ChatView/FocusMode     │
    │  ├─ right area: CuratedBlocksColumn     │
    │  └─ status area: IdeationStatusBar      │
    │                                          │
    │  Physics Sync (60fps via RAF)           │
    │  └─ PhysicsBlockBase position updates   │
    └────────────────────────────────────────┘
```

## Physics Engine Integration

```
FormingBlocksColumn
    │
    ├─ usePhysicsEngine(containerRef)
    │   │
    │   ├─ Initialize Matter.js
    │   │   ├─ Create Engine (zero gravity)
    │   │   ├─ Add wall boundaries
    │   │   ├─ Add mouse constraint for dragging
    │   │   └─ Start Runner
    │   │
    │   ├─ addBody(id, radius) on mount
    │   │   └─ Bodies.circle(x, y, radius) with properties
    │   │       ├─ restitution: 0.3 (bounciness)
    │   │       ├─ friction: 0.1
    │   │       ├─ frictionAir: 0.02
    │   │       └─ density: 0.001
    │   │
    │   ├─ beforeUpdate event (each tick)
    │   │   ├─ Calculate initiative centroids
    │   │   ├─ Apply central attraction force
    │   │   └─ Apply initiative grouping force
    │   │
    │   ├─ afterUpdate event
    │   │   └─ Extract position/angle → setState(bodies Map)
    │   │
    │   └─ removeBody(id) on unmount
    │
    └─ Render PhysicsBlock for each body
        └─ PhysicsBlockBase (position sync)
            └─ requestAnimationFrame loop
                └─ element.style.transform = translate(x, y) rotate(angle)
```

## State Management Strategy

### URL State (Source of Truth for Navigation)
```
/ideation                          → DashboardPage
/ideation/session/:id              → CanvasPage (normal view)
/ideation/session/:id?block=:id    → CanvasPage (focus mode)
```

**Sync Pattern** (CanvasPage):
```typescript
const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

// On mount: read URL
useEffect(() => {
  const blockId = searchParams.get('block');
  if (blockId !== focusedBlockId) {
    setFocusedBlockId(blockId);
  }
}, [searchParams]);

// On state change: update URL
const handleBlockClick = (blockId: string) => {
  setFocusedBlockId(blockId);
  setSearchParams({ block: blockId });
};
```

### LocalStorage State (UI Preferences)
```typescript
// Specialist panel collapse state
usePanelState()
  ├─ Read from localStorage['ideation-panel-collapsed']
  ├─ Update localStorage on change
  └─ Persist user preference

// Theme
useTheme()
  ├─ Read from localStorage['theme']
  └─ Update document.documentElement.classList

// User settings
useUserSettings()
  └─ Various user preferences in localStorage
```

### Server State (via Hooks)

**Pattern 1: Fetch + SSE Subscribe (useBlocks)**
```typescript
useBlocks(sessionId)
  │
  ├─ Fetch: GET /api/ideation/sessions/{sessionId}/blocks
  │   └─ setBlocks(data)
  │
  └─ Subscribe: EventSource /api/ideation/sessions/{sessionId}/events
      └─ On 'session:block_*' event
          ├─ If event has blocks array: setBlocks(event.blocks)
          └─ Else: refetch()

// Mutations (trigger SSE update)
curateBlock(blockId)
  └─ POST /api/ideation/sessions/{sessionId}/blocks/{blockId}/curate
      └─ SSE sends updated blocks

updateBlock(blockId, updates)
  └─ PATCH /api/ideation/sessions/{sessionId}/blocks/{blockId}
      └─ SSE sends updated blocks
```

**Pattern 2: Fetch Only (useSession)**
```typescript
useSession(sessionId)
  └─ Fetch: GET /api/ideation/sessions/{sessionId}
      └─ setState(session, loading, error)
```

**Pattern 3: Fetch + Callbacks (useSessionEvents)**
```typescript
useSessionEvents(sessionId, {
  onTranscript: (messages) => setTranscript(messages),
  onStatus: (status) => handleStatusChange(status),
  onUnderstanding: (data) => setUnderstanding(data),
})
  │
  └─ Subscribe: EventSource /api/ideation/sessions/{sessionId}/events
      ├─ 'session:transcript_updated' → onTranscript
      ├─ 'session:status_changed' → onStatus
      ├─ 'session:understanding_updated' → onUnderstanding
      └─ (Caller decides what to do with events)
```

## CSS Architecture

### Global Theme Variables (in globals.css)

```css
:root {
  /* Canvas background */
  --canvas-bg: #1a1a1a;
  --canvas-bg-subtle: #2a2a2a;
  --canvas-text-primary: #ffffff;
  --canvas-text-muted: #888888;
  --canvas-accent: #ff6b6b;

  /* Block styling */
  --block-draft: rgba(255, 107, 107, 0.1);
  --block-draft-border: #ff6b6b;
  --block-curated: rgba(76, 175, 80, 0.1);
  --block-curated-border: #4CAF50;

  /* Layout dimensions */
  --sidebar-width: 280px;
  --specialists-panel-width: 320px;

  /* Mobile friendly */
  @media (max-width: 768px) {
    --sidebar-width: 240px;
    --specialists-panel-width: 240px;
  }
}
```

### Tailwind Configuration (tailwind.config.cjs)

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg': {
          'deep': 'var(--bg-deep)',
          'primary': 'var(--bg-primary)',
          'secondary': 'var(--bg-secondary)',
          'tertiary': 'var(--bg-tertiary)',
        },
        'text': {
          'primary': 'var(--text-primary)',
          'secondary': 'var(--text-secondary)',
          'muted': 'var(--text-muted)',
        },
      },
      animation: {
        'physics-block-pop-in': 'popIn 0.3s ease-out',
        'physics-block-pop-out': 'popOut 0.2s ease-in',
      },
    },
  },
};
```

### Component-Level Styling

**Pattern: CSS Variables + Tailwind**
```tsx
// PhysicsBlock.tsx
style={{
  backgroundColor: 'var(--block-draft)',
  borderColor: `hsl(${borderStyle.hue} 70% 45%)`,
  borderWidth: `${borderStyle.width}px`,
  boxShadow: getBoxShadow(showGlow, borderStyle.hue),
}}

// CuratedBlockCard
style={{
  backgroundColor: 'var(--block-curated)',
  borderLeft: '3px solid var(--block-curated-border)',
}}
```

## Responsive Design Strategy

### Desktop (≥ md breakpoint, 768px)
- Full 3-column layout (FormingBlocks | Chat | CuratedBlocks)
- Physics simulation enabled
- Specialists panel visible (collapsible)
- All actions visible in header

### Mobile (< md breakpoint)
- Vertical stack: nav → center → left → right → status
- Physics disabled (performance)
- Hamburger menu consolidates actions
- Panel hidden by default
- Touch-friendly minimum sizes (44×44px buttons)

### CSS Grid Media Query (IdeationGridLayout)
```css
.grid {
  display: flex; /* Mobile: flex column */
  flex-direction: column;

  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: minmax(300px, 1.5fr) minmax(320px, 1.5fr) minmax(200px, 1fr);
    grid-template-rows: auto 1fr auto;
    /* 3-column layout */
  }
}
```

## Performance Optimizations

### 1. Physics Only on Desktop
```typescript
const isMobile = useIsMobile();
const physicsResult = usePhysicsEngine(isMobile ? { current: null } : containerRef);
```
- Mobile gets static list instead of physics simulation
- Prevents jank on low-end devices

### 2. GPU-Accelerated Transforms
```css
will-change: transform;
transform: translate3d(...) rotate(...);
```
- Promotes element to its own layer
- 60fps smooth motion

### 3. Memoization in Hooks
```typescript
const getSessionsRef = useRef(getSessions);
getSessionsRef.current = getSessions;

useEffect(() => {
  fetchSessions();
}, [fetchSessions]); // stable reference
```
- Prevents infinite effect loops
- Stable callback references

### 4. Efficient SSE Reconnection
```typescript
const delay = RECONNECT_DELAY * Math.min(attemptCount, 3); // exponential backoff, capped
// 3s → 6s → 12s → 12s (max)
```
- Prevents overwhelming server on connection loss

### 5. Large Array Handling
```typescript
// Physics bodies stored in Map, not array
const bodies = new Map<string, PhysicsBody>();

// O(1) lookup by block ID
const position = bodies.get(block.id);
```

## Security & Error Handling

### Error Handling Pattern
```typescript
// API Fetch with error conversion
const res = await fetch(url);
if (!res.ok) {
  throw new Error(`Failed: HTTP ${res.status}`);
}
const data = await res.json();

// Hook-level error state
const [error, setError] = useState<Error | null>(null);

// Component displays error with retry
if (error) {
  return (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={refetch}>Retry</button>
    </div>
  );
}
```

### Optional Chaining & Nullish Coalescing
```typescript
const confidence = block.confidence ?? 0;
const role = specialist.roleHint?.toLowerCase();

// Safe property access
const concernCount = session?.understanding?.['specialist']?.concerns?.length ?? 0;
```

## Development Workflow

### File Organization
```
src/
├── App.tsx                          # Root + routing
├── main.tsx                         # Entry point
├── pages/
│   ├── CanvasPage.tsx              # /ideation/session/:id
│   ├── DashboardPage.tsx           # /ideation
│   └── ...
├── components/
│   ├── canvas/                     # Canvas-specific (3-column)
│   ├── chat/                       # Chat components
│   ├── dashboard/                  # Dashboard-specific
│   ├── layout/                     # Layout containers
│   ├── shared/                     # Reusable (PhysicsBlockBase)
│   ├── specialists/                # Expert/specialist UI
│   ├── ui/                         # shadcn components
│   └── icons/                      # Custom SVG icons
├── hooks/                          # React hooks
├── lib/                            # Utilities
└── styles/
    └── globals.css                 # Theme variables
```

### Testing Pattern
```typescript
// Vitest + React Testing Library
describe('PhysicsBlock', () => {
  it('should render emoji for emerging+ blocks', () => {
    const { container } = render(
      <PhysicsBlock
        block={{ confidence: 50, status: 'emerging' }}
        position={{ x: 100, y: 100 }}
        size={60}
      />
    );
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });
});
```

---

## Summary

**Ideation-UI is a well-structured, production-grade React app with:**

1. **Clear separation of concerns**: Layout (grid), data (hooks), rendering (components)
2. **Reusable physics engine**: Zero-gravity Matter.js with custom forces
3. **Real-time architecture**: SSE for live updates with exponential backoff
4. **Responsive design**: Desktop physics, mobile list (performance-conscious)
5. **Type-safe patterns**: TypeScript interfaces, union types for status
6. **Accessible patterns**: ARIA labels, semantic HTML, keyboard navigation
7. **Polished UX**: Smooth animations, optimistic updates, clear error states

**For "Tend" reuse**: Most components are 80-90% reusable with semantic/naming adaptations.

---

**End of Architecture Overview**
