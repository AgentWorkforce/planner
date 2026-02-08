# Ideation-UI → Tend Migration Notes

**For planning the unified "Tend" app design.**

---

## Quick Navigation Map

The ideation-ui is organized into 6 functional zones matching the layout:

```
┌──────────────────────────────────────────────────────────────┐
│                  SessionNav (CanvasHeader)                   │ ← HEADER
├─────────────────┬──────────────────────┬─────────────────────┤
│                 │                      │                     │
│   FormingBlocks │   SessionChatView    │  CuratedBlocksColumn│
│   (with physics │   (centered)         │  (vertical list)    │
│    simulation)  │                      │                     │
│                 │                      │                     │
├─────────────────┴──────────────────────┴─────────────────────┤
│                   IdeationStatusBar                          │ ← STATUS
└──────────────────────────────────────────────────────────────┘
```

**Key files** for each zone:

| Zone | Component | File | Purpose |
|------|-----------|------|---------|
| **HEADER** | SessionNav | `components/canvas/CanvasHeader.tsx` | Title, confidence, actions |
| **LEFT** | FormingBlocksColumn | `components/canvas/FormingBlocksColumn.tsx` | Physics blocks (forming status) |
| **LEFT** | PhysicsBlock | `components/canvas/PhysicsBlock.tsx` | Individual block with styling |
| **LEFT (base)** | PhysicsBlockBase | `components/shared/PhysicsBlockBase.tsx` | Position sync + rotation |
| **CENTER** | SessionChatView | `components/chat/SessionChatView.tsx` | Chat messages + input |
| **CENTER** | FocusMode | `components/canvas/FocusMode.tsx` | Detail panel + chat side-by-side |
| **RIGHT** | CuratedBlocksColumn | `components/canvas/CuratedBlocksColumn.tsx` | Vertical list of curated blocks |
| **LAYOUT** | IdeationGridLayout | `components/canvas/IdeationGridLayout.tsx` | CSS Grid managing all zones |
| **STATUS** | IdeationStatusBar | `components/canvas/IdeationStatusBar.tsx` | Agent status bar |

---

## Core Systems

### 1. Physics Engine
**Hook**: `usePhysicsEngine`
**File**: `hooks/usePhysicsEngine.ts`

Zero-gravity Matter.js with custom attraction forces.

**Key numbers**:
- Central attraction: `0.00008` (gentle drift)
- Initiative grouping: `0.00015` (stronger, creates clusters)
- Edge attraction: `0.00012` (for abandoned items)
- Spawn offset: ±80px from center
- Wall thickness: 100px (containment)

**For Tend**:
- Reuse as-is for block physics
- Adjust forces for "tend" UI semantics
- Consider different density/mass for different block types

### 2. Block Confidence → Size/Opacity Mapping
**Utilities**: `components/canvas/utils/blockVisibility.ts`

Blocks progress through 5 visibility states as confidence increases:

```
0-30%: forming     → tiny dot (20px)
30-60%: emerging   → shows emoji (40-60px)
60-90%: developing → shows keyword (60-80px)
90-100%: ready     → full display (80-100px) + glow
curated: fixed     → right column
```

**For Tend**:
- Adapt state names for "tend" semantics (e.g., "nascent" → "forming")
- Keep the gradual revelation pattern (emoji → keyword → full)
- Consider custom size algorithm for "tend" block types

### 3. Real-time Updates via SSE
**Patterns**: `useBlocks`, `useSession`, `useSessionEvents`, `useUnderstanding`

- EventSource to `/api/ideation/sessions/{id}/events`
- Auto-reconnect with exponential backoff (max 5 attempts)
- Event types: `session:block_*`, `session:status_*`, etc.
- Individual hooks subscribe independently

**For Tend**:
- Reuse SSE pattern
- Adapt event types to "tend" domain
- Consider consolidating multiple SSE streams if performance needed

### 4. Chat Context Window
**Component**: `SessionChatView`
**Subcomponents**: `ChatInput`, `ChatMessageList`, `ChatBubble`, `TypingIndicator`

- Optional focus mode: messages scoped to one block (context banner at top)
- Optimistic updates: add message before server ack
- Typing indicator while assistant responds

**For Tend**:
- Reuse chat components almost entirely
- Adapt context banner for "tend" focus targets
- Change message styling if needed

### 5. Focus Mode Detail Panel
**Component**: `FocusMode`
**Pattern**: 60% detail + 40% chat side-by-side

- Markdown editor for content (with preview)
- Block metadata (type, confidence, status, specialist)
- User edits timeline
- Curate button (primary action)
- Close button (X)
- Entry animation: `focus-mode-enter`

**For Tend**:
- Perfect pattern for detailed block editing
- Adapt metadata display
- Reuse markdown editor
- Change button labels + colors

---

## State Management Architecture

### URL State (Best Practice)
- Session ID: route param `/ideation/session/:id`
- Focused block: query param `?block=:blockId`
- Page routes: `/ideation` (dashboard), `/canvas` (canvas)

**For Tend**:
- Use same URL pattern for discoverability
- Sync component state with URL on mount/change

### LocalStorage State
- Right panel collapse: `usePanelState` → `ideation-panel-collapsed`
- Theme preference: `useTheme`
- User settings: `useUserSettings`

**For Tend**:
- Reuse localStorage pattern for UI state
- Prefix keys to avoid conflicts: `tend-panel-collapsed`, etc.

### Server State via Hooks (Recommended)
All data fetching + real-time via custom hooks:
- `useBlocks(sessionId)` → fetch + SSE subscribe
- `useSession(sessionId)` → fetch session metadata
- `useSessions()` → fetch all sessions
- `useSessionEvents(sessionId, callbacks)` → SSE only
- `useUnderstanding(sessionId)` → fetch specialist data

**For Tend**:
- Adopt same hook-based pattern
- Create `useTendBlocks`, `useTendSession`, etc.
- Keep mutations (`curateBlock`, `updateBlock`) in same hook

---

## Dashboard View (Multi-session)

**Route**: `/ideation`
**Component**: `SessionDashboard` → `IdeationGridLayout`

Layout:
- LEFT: `SessionsPhysicsColumn` — sessions as physics blocks
- CENTER: `NavigatorChat` — meta-chat
- RIGHT: `SentToPlannerColumn` — handoff tracking
- STATUS: IdeationStatusBar

**Physics on Dashboard**:
- Uses `usePhysicsEngine` with `edgeAttractionFilter`
- Abandoned sessions drift to edges
- Active sessions cluster in center

**For Tend**:
- Reuse layout pattern (works well)
- Adapt SessionsPhysicsBlock to "tend" session display
- Change NavigatorChat to "tend" meta-chat
- Simplify right column or remove

---

## Right Panel: Specialists / Experts

**Component**: `SpecialistsPanel`
**Data Source**: `useUnderstanding` hook + SSE updates

Displays:
- Active specialists (agents) from understanding keys
- Confidence bar for overall readiness
- Per-specialist cards with observations
- Concerns + questions aggregated

**For Tend**:
- Rename "Specialists" → "Experts" or "Advisors"
- Adapt "understanding" data structure to "tend" domain
- Keep confidence aggregation pattern
- Change card layout if needed

---

## Animations & Transitions

### CSS Classes (in globals.css)
- `physics-block-pop-in` — entry animation (scale up)
- `physics-block-pop-out` — exit animation (scale down)
- `focus-mode-enter` — fade in
- `slide-in-from-left-2 fade-in` — curated block entry

### Tailwind Built-ins
- `animate-pulse` — ready block glow
- `animate-in fade-in-0 zoom-in-95` — dropdown open
- Transition classes: `transition-all duration-200`

### RequestAnimationFrame (60fps)
- `PhysicsBlockBase` syncs physics position to DOM each frame
- GPU acceleration: `will-change: transform`

**For Tend**:
- Reuse animation infrastructure
- Adapt animation names to "tend" terminology
- Keep 60fps physics sync pattern

---

## CSS Variables & Theming

### Canvas Theme (ideation-ui/src/styles/globals.css)
```css
--canvas-bg
--canvas-bg-subtle
--canvas-text-primary
--canvas-text-muted
--canvas-accent (action buttons)
--block-draft (forming/emerging background)
--block-draft-border
--block-curated (curated background)
--block-curated-border (green)
--sidebar-width (280px)
--specialists-panel-width (320px)
```

**For Tend**:
- Define "tend" color scheme in same variable format
- Keep variable names for maintainability
- Adapt border colors (green for curated → ? for tend)

---

## Key Integration Patterns

### 1. Blocks Array as Single Source of Truth
```typescript
interface Block {
  id: string;
  emoji: string;
  keyword: string;
  status: 'forming' | 'emerging' | 'developing' | 'ready' | 'curated';
  confidence: number;
  content: string;
  userEdited?: boolean;
  userEditedFields?: string[];
  // ... more fields
}
```

- Passed to `FormingBlocksColumn`, `CuratedBlocksColumn`, `FocusMode`
- Mutations via `useBlocks` API
- Real-time updates via SSE

**For Tend**:
- Keep blocks as core data structure
- Adapt fields (e.g., add "type", "category", etc.)
- Maintain same mutation API pattern

### 2. Component Nesting Pattern
```
CanvasPage (route container)
  ↓ renders
IdeationGridLayout (grid layout)
  ├→ SessionNav (header with actions)
  ├→ FormingBlocksColumn (left)
  │   └→ PhysicsBlock × N
  │       └→ PhysicsBlockBase (position sync)
  ├→ SessionChatView (center)
  │   ├→ ChatMessageList (scroll area)
  │   └→ ChatInput (text input)
  ├→ CuratedBlocksColumn (right)
  │   └→ CuratedBlockCard × N
  └→ IdeationStatusBar (status)

(Overlays, not in grid)
  - FocusMode (wraps ChatView when focused)
  - AIUnderstandingDrawer (slide-out)
  - HandoffDialog (modal)
```

**For Tend**:
- Maintain same nesting depth
- Adapt component names
- Same layout grid pattern

### 3. Focus Mode Transition
- CanvasPage stores `focusedBlockId` (local state + URL param)
- When focused:
  - `FocusMode` wrapper replaces normal center content
  - `IdeationGridLayout` switches to 2-column (focus mode)
  - SessionChatView becomes chat sidebar (40%)
  - Block detail becomes main panel (60%)
- URL sync: `setSearchParams({ block: blockId })`

**For Tend**:
- Perfect pattern for "tend" detail view
- Reuse without modification

---

## API Endpoints Called

### Blocks
- `GET /api/ideation/sessions/{id}/blocks` — fetch all
- `POST /api/ideation/sessions/{id}/blocks/{id}/curate` — mark curated
- `PATCH /api/ideation/sessions/{id}/blocks/{id}` — update field
- `DELETE /api/ideation/sessions/{id}/blocks/{id}` — delete

### Sessions
- `GET /api/ideation/sessions` — list all
- `GET /api/ideation/sessions/{id}` — fetch one
- `PATCH /api/ideation/sessions/{id}` — update metadata
- `POST /api/ideation/sessions/{id}/send-to-planner` — handoff

### Real-time
- `EventSource /api/ideation/sessions/{id}/events` — SSE stream
- Event types: `session:block_created`, `session:block_updated`, `session:status_changed`, etc.

### Chat
- `POST /api/ideation/sessions/{id}/messages` — send message
- Event: `session:transcript_updated` → new transcript

**For Tend**:
- Adapt endpoint paths to `/api/tend/...`
- Keep request/response shapes compatible (if possible)
- Reuse SSE event pattern

---

## Development Notes

### TypeScript Patterns
- Interfaces for props (strict typing)
- Type narrowing in conditionals (e.g., `block.status !== 'curated'`)
- Optional fields with `?` and nullish coalescing (`??`)
- Union types for statuses: `BlockStatus = 'forming' | 'emerging' | ...`

### React Patterns
- `useCallback` for event handlers (prevent re-renders)
- `useRef` for DOM access (getBoundingClientRect, resize observer)
- `useMemo` for expensive calculations
- `useEffect` for side effects with cleanup
- Conditional rendering: ternary or `&&`
- Component composition over prop drilling

### Tailwind v4 CSS Variables
- Define in `:root` selector
- Reference via `var(--name)`
- Use arbitrary values: `bg-[var(--canvas-bg)]`
- Nested color scales: `text-primary`, `text-secondary`, etc.

### Performance Considerations
- Mobile: Physics disabled (useIsMobile check)
- Desktop: 60fps physics sync via RAF
- SSE reconnection: exponential backoff (3s, 6s, 12s...)
- Large block arrays: use Map for O(1) lookup (physics bodies)
- Chat scrolling: debounce or throttle if needed

---

## Migration Checklist for Tend

- [ ] Copy `PhysicsBlockBase`, `PhysicsBlock`, `usePhysicsEngine` (reusable)
- [ ] Copy chat components: `ChatInput`, `ChatMessageList`, `ChatBubble`, `TypingIndicator`
- [ ] Copy layout: `IdeationGridLayout` (rename/adapt)
- [ ] Copy `FocusMode` component and adapt
- [ ] Create `tend-` prefixed hooks from ideation hooks
- [ ] Adapt color scheme: CSS variables, `--tend-*` naming
- [ ] Define "tend" block structure (inherit from ideation Block)
- [ ] Create "tend" API client (adapt from `useIdeationApi`)
- [ ] Set up SSE event types (adapt from ideation)
- [ ] Create navigation routes (`/tend/...`)
- [ ] Adapt specialist/expert panel (or remove if not needed)
- [ ] Update icon set (reuse or customize)
- [ ] Set up testing (vitest + React Testing Library)
- [ ] Document custom patterns specific to "tend"

---

## Open Questions for Tend Design

1. **Should "tend" have dashboard view?** (SessionDashboard pattern available)
2. **Does "tend" need specialist/expert insights?** (SpecialistsPanel pattern available)
3. **Should "tend" blocks have different states?** (adapt confidence → tendency mapping)
4. **What's the "right column" output format?** (reuse CuratedBlocksColumn pattern or customize)
5. **Should handoff to external system be supported?** (HandoffDialog pattern available)
6. **Multi-session support needed?** (dashboard handles this)
7. **Mobile-first or desktop-first?** (current: responsive, physics on desktop only)

---

**End of Migration Notes**

See full component map: `/docs/ideation-ui-components-map.md`
