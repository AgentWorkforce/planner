# Ideation-UI Building Blocks Map

**Purpose**: Complete inventory of ideation-ui components, hooks, and patterns for planning reuse/transformation into "tend" unified app.

**App Structure**: Three-column layout with physics engine, chat, and structured output.

---

## Table of Contents

1. [Core Layout System](#core-layout-system)
2. [LEFT Column: Forming Blocks & Physics](#left-column-forming-blocks--physics)
3. [CENTER Column: Chat & Conversation](#center-column-chat--conversation)
4. [RIGHT Column: Curated Blocks & Output](#right-column-curated-blocks--output)
5. [STATUS BAR](#status-bar)
6. [Hooks](#hooks)
7. [Contexts & State Management](#contexts--state-management)
8. [Pages & Routing](#pages--routing)
9. [Shared Components (Specialists, Icons)](#shared-components-specialists-icons)
10. [Utilities & Libs](#utilities--libs)

---

## Core Layout System

### IdeationGridLayout
**File**: `/packages/ideation-ui/src/components/canvas/IdeationGridLayout.tsx`

CSS Grid layout for three-column ideation canvas + focus mode variant.

**Features**:
- Desktop (normal): 3-column grid (LEFT | NAV/CENTER | RIGHT) + STATUS BAR
  - Grid areas: `left`, `nav`, `center`, `right`, `status`
  - Grid columns: `minmax(300px, 1.5fr) minmax(320px, 1.5fr) minmax(200px, 1fr)`
  - Rows: `auto 1fr auto` (nav, content, status)
- Desktop (focus mode): 2-column grid (NAV/CENTER | RIGHT) + STATUS BAR
  - Grid columns: `minmax(400px, 3fr) minmax(200px, 1fr)`
  - Left panel auto-hidden
- Mobile (<md breakpoint): Vertical stack
  - Order: nav → center → left → right → status
  - Flexbox layout
- **GPU acceleration**: `will-change: transform` on status bar
- **Critical**: All cells maintain real dimensions for physics getBoundingClientRect()

**Props**:
```typescript
interface IdeationGridLayoutProps {
  nav: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  center: ReactNode;
  statusBar?: ReactNode;
  focusMode?: boolean;
  className?: string;
}
```

**Used By**: CanvasPage, SessionDashboard, all canvas variants

---

### IdeationLayout
**File**: `/packages/ideation-ui/src/components/layout/IdeationLayout.tsx`

Legacy 3-column container for sidebar + main + right panel (Specialists).

**Features**:
- Left sidebar: width `var(--sidebar-width)`, always visible
- Main content: flex-1, scrollable
- Right panel: width `var(--specialists-panel-width)`, collapsible
  - Shown only on lg breakpoint
  - Collapsed state: floating chevron button on right edge
- Transitions on collapse (200ms)

**Props**:
```typescript
interface IdeationLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  panel?: ReactNode;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
}
```

**Used By**: App.tsx (legacy SessionPage routes)

---

## LEFT Column: Forming Blocks & Physics

### FormingBlocksColumn
**File**: `/packages/ideation-ui/src/components/canvas/FormingBlocksColumn.tsx`

Container for non-curated blocks with optional physics simulation.

**Features**:
- Desktop: Matter.js physics engine with central attraction
- Mobile: Simple vertical list (performance optimization)
- Filters blocks with `status !== 'curated'`
- Renders PhysicsBlock components
- Block size: `getBlockSize(confidence, contentLength)` → 20-100px radius
- Sync physics bodies: addBody/removeBody on block array changes
- Boundary walls at container edges
- Mouse constraint for drag interaction

**Block Status Progression**:
- `forming` (0-30%): tiny dot, no content
- `emerging` (30-60%): 40-60px, shows emoji
- `developing` (60-90%): 60-80px, shows emoji + keyword
- `ready` (90-100%): 80-100px, adds glow/pulse
- `curated`: moved to right column

**Dependencies**:
- `usePhysicsEngine` — manages Matter.js simulation
- `useIsMobile` — detect mobile viewport
- `PhysicsBlock` — individual block renderer
- `getBlockSize`, `getVisibilityLevel`, etc. — blockVisibility utils

**Props**:
```typescript
interface FormingBlocksColumnProps {
  blocks: Block[];
  onBlockClick?: (blockId: string) => void;
  className?: string;
}

interface Block {
  id: string;
  type: string;
  title: string;
  emoji: string;
  keyword: string;
  content: string;
  specialist: string;
  sourceContext: string;
  confidence: number;
  status: BlockStatus;
  createdAt: string;
  curatedAt?: string | null;
  userEdited?: boolean;
  userEditedFields?: string[];
}
```

---

### PhysicsBlock
**File**: `/packages/ideation-ui/src/components/canvas/PhysicsBlock.tsx`

Individual canvas block with physics sync and confidence-based rendering.

**Features**:
- Rendered by PhysicsBlockBase (position, rotation, animation)
- Size/opacity scales with confidence (0-100%)
- Status-based visibility (forming → ready)
- Draggable via physics engine MouseConstraint
- GPU-accelerated transforms: `translate3d()` + `rotate()`
- Border styling: yellow (low confidence) → green (high confidence)
- User edited indicator: cyan dot in top-right
- Keyword label truncation for small blocks

**Visual Properties**:
- Border color: HSL gradient based on confidence
  - Low (0%): Yellow (50° hue)
  - High (100%): Green (120° hue)
- Box shadow: Glow effect when `confidence > 90`
- Animation: `animate-pulse` when ready
- Opacity: `Math.pow(confidence / 100, 0.6)` (scales with confidence)
- Border radius: Circular for forming, rounded square for emerging+

**Props**:
```typescript
interface PhysicsBlockProps {
  block: {
    id: string;
    emoji: string;
    keyword: string;
    confidence: number;
    status: BlockStatus;
    userEdited?: boolean;
  };
  position: { x: number; y: number };
  angle?: number; // radians from physics engine
  size: number; // derived from confidence
  onClick?: () => void;
}
```

---

### PhysicsBlockBase
**File**: `/packages/ideation-ui/src/components/shared/PhysicsBlockBase.tsx`

Shared base for physics-driven blocks (used by canvas + dashboard).

**Features**:
- Position sync via requestAnimationFrame (60fps)
- Rotation support from physics engine
- Size transitions with easing (200-300ms)
- Z-index layering: `zIndex = Math.round(activityScore)`
- Animation states: `entering`, `exiting`, `idle`
  - CSS classes: `physics-block-pop-in`, `physics-block-pop-out`
- Abandoned styling: `opacity-40`, `hover:opacity-60`
- GPU acceleration: `will-change: transform`

**Position Sync Pattern**:
```typescript
const updatePosition = () => {
  const left = position.x - size / 2;
  const top = position.y - size / 2;
  const rotation = angle !== 0 ? ` rotate(${angle}rad)` : '';
  element.style.transform = `translate(${left}px, ${top}px)${rotation}`;
  animationFrameRef.current = requestAnimationFrame(updatePosition);
};
```

**Props**:
```typescript
interface PhysicsBlockBaseProps {
  id: string;
  position: { x: number; y: number };
  angle?: number;
  size: number;
  activityScore?: number; // 0-100, for z-index
  isAbandoned?: boolean;
  animationState?: 'entering' | 'exiting' | 'idle';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
}
```

**Used By**: PhysicsBlock (canvas), SessionPhysicsBlock (dashboard)

---

### Block Visibility Utils
**File**: `/packages/ideation-ui/src/components/canvas/utils/blockVisibility.ts`

Utilities for confidence-based rendering decisions.

**Key Functions**:
- `getVisibilityLevel(confidence)` → `'forming' | 'emerging' | 'developing' | 'ready'`
- `getBlockSize(confidence, contentLength)` → pixels (20-100)
- `getBlockOpacity(confidence)` → 0-1
- `shouldShowKeyword(confidence, size)` → boolean
- `shouldShowGlow(confidence)` → boolean
- `getBorderStyle(confidence)` → `{ width, hue, opacity }`
- `getBorderRadius(visibilityLevel)` → CSS value
- `getEmojiSizeClass(size)` → Tailwind class
- `getBoxShadow(showGlow, hue)` → CSS shadow
- `isBlockInteractive(confidence)` → boolean (>= 30%)

---

### CuratedBlocksColumn
**File**: `/packages/ideation-ui/src/components/canvas/CuratedBlocksColumn.tsx`

Right column showing vertical stack of curated (status='curated') blocks.

**Features**:
- Filters blocks: `status === 'curated'`
- Card layout with emoji + keyword
- Green left border: `var(--block-curated-border)`
- Background: `var(--block-curated)`
- Hover effects: shadow lift
- Uncurate button (arrow): moves block back to physics
- Entry animation: `slide-in-from-left-2 fade-in`
- Scrollable when content overflows
- Empty state: helpful message

**Components**:
1. **CuratedBlockCard**: Individual card
   - Emoji (text-xl)
   - Keyword + confidence % label
   - Uncurate button with event stopPropagation
2. **CuratedBlocksColumn**: Container
   - Count badge
   - Scrollable list

**Dependencies**: None (pure presentational)

---

## CENTER Column: Chat & Conversation

### SessionChatView
**File**: `/packages/ideation-ui/src/components/chat/SessionChatView.tsx`

Chat interface for session interaction and focused block discussions.

**Features**:
- Real-time transcript updates via `useSessionEvents` hook
- Optional focus mode: contextual chat scoped to one block
- Context banner: shows focused block emoji + keyword when in focus
- Optimistic message UI: add user message before server acks
- Typing indicator: shows when assistant is responding
- Auto-scrolling message list
- Message list + input + typing indicator layout
- Disabled state when session abandoned

**Optional Focus Mode**:
- Props: `focusedBlockId`, `focusedBlock: { id, emoji, keyword }`
- Renders cyan context banner at top
- Messages scoped to block context
- Focused block info in messages payload

**Dependencies**:
- `useSession` — fetch session + metadata
- `useSessionEvents` — SSE subscription for transcript updates
- `useSendMessage` — send messages with optional block scope
- `ChatMessageList` — render transcript
- `ChatInput` — text input component
- `TypingIndicator` — activity indicator

**Props**:
```typescript
interface SessionChatViewProps {
  sessionId: string;
  focusedBlockId?: string;
  focusedBlock?: { id: string; emoji: string; keyword: string };
}
```

---

### ChatInput
**File**: `/packages/ideation-ui/src/components/chat/ChatInput.tsx`

Expandable textarea for composing messages.

**Features**:
- Auto-resize: min 3 lines, max 6 lines per line height (20px)
- Enter to send, Shift+Enter for newline
- Disabled state dims input + hides send button
- Send button: `variant="primary"` with SendIcon
- Placeholder text customizable
- Trim whitespace on send

**Styling**:
- Border + shadow: bg-bg-secondary
- Focus: no outline (managed by parent)
- Disabled: opacity-50, cursor-not-allowed
- Button: absolute bottom-right

---

### ChatMessageList
**File**: `/packages/ideation-ui/src/components/chat/ChatMessageList.tsx`

Scrollable list of chat messages with role-based styling.

**Renders**: ChatBubble components for each message

---

### ChatBubble
**File**: `/packages/ideation-ui/src/components/chat/ChatBubble.tsx`

Individual message bubble with role-based alignment + styling.

**Features**:
- User messages: right-aligned, blue accent
- Assistant messages: left-aligned, subtle background
- Optional metadata (timestamp, confidence)
- Markdown rendering support
- Fade-in animation

---

### TypingIndicator
**File**: `/packages/ideation-ui/src/components/chat/TypingIndicator.tsx`

Animated dots showing assistant is composing.

**Animation**: Bouncing dots with stagger effect

---

### ConfidenceBar
**File**: `/packages/ideation-ui/src/components/chat/ConfidenceBar.tsx`

Visual indicator of session readiness/confidence level.

**Features**:
- Horizontal progress bar
- Color gradient: red (low) → yellow → green (high)
- Optional label + percentage text
- Tooltip on hover

---

### FocusMode
**File**: `/packages/ideation-ui/src/components/canvas/FocusMode.tsx`

Full-screen layout transition for detailed block editing.

**Layout Transition**:
- Normal 3-column → Focus 2-column (detail | contextual chat)
- Left panel (60%): Block details, editable markdown
- Right panel (40%): Contextual chat slot

**Features**:
- Block metadata: type, confidence, status, specialist
- Editable markdown content via MarkdownEditor
- Curate button (check icon) + close button (X)
- Source context badges
- User edits timeline (last 3, with +N more indicator)
- Entry animation: `focus-mode-enter`

**Props**:
```typescript
interface FocusModeProps {
  block: FocusModeBlock;
  onClose: () => void;
  onCurate: () => void;
  onContentChange?: (content: string, userEdited: boolean, editedField?: string) => void;
  children?: ReactNode;
  className?: string;
}
```

**Used By**: CanvasPage wraps SessionChatView in FocusMode

---

### MarkdownEditor
**File**: `/packages/ideation-ui/src/components/canvas/MarkdownEditor.tsx`

Editable markdown textarea with syntax highlighting.

**Features**:
- Markdown preview toggle
- Syntax highlighting in preview
- Min/max height configurable
- Field name tracking for user edits
- onChange callback with (content, userEdited, fieldName)

---

## RIGHT Column: Curated Blocks & Output

See [CuratedBlocksColumn](#curatedblockcolumn) above.

**Also contains**: Sent to Planner column (dashboard view)

### SentToPlannerColumn
**File**: `/packages/ideation-ui/src/components/dashboard/SentToPlannerColumn.tsx`

Dashboard right column showing sessions sent to planner.

**Features**:
- List of projects/sessions with handoff status
- Status badges: "Planning", "Plan Ready", etc.
- Optional click handler for details

---

## STATUS BAR

### IdeationStatusBar
**File**: `/packages/ideation-ui/src/components/canvas/IdeationStatusBar.tsx`

Thin wrapper bridging SpecialistPresence → shared-ui StatusBar.

**Features**:
- Maps specialist presence data to AgentStatus
- Renders at bottom of grid (S area)
- Canvas theming: `bg-[var(--canvas-bg)]`
- Optional agents list, overall confidence, actions

**Dependencies**:
- Imports `StatusBar` from `@plannr/shared-ui`
- Receives specialist data from parent

---

## Hooks

### usePhysicsEngine
**File**: `/packages/ideation-ui/src/hooks/usePhysicsEngine.ts`

Matter.js physics engine with central + edge attraction forces.

**Features**:
- Zero gravity (custom forces only)
- Central attraction force: `ATTRACTION_FORCE = 0.00008`
- Initiative grouping force: `INITIATIVE_FORCE = 0.00015` (stronger)
- Edge attraction force: `EDGE_ATTRACTION_FORCE = 0.00012`
- Wall boundaries at container edges
- Mouse constraint for drag interaction
- Collision detection (circles)
- Spawn offset: ±80px from center

**API**:
```typescript
interface UsePhysicsEngineReturn {
  engine: Engine | null;
  addBody: (options: CreateBodyOptions) => void;
  removeBody: (id: string) => void;
  updateBodyRadius: (id: string, radius: number) => void;
  bodies: Map<string, PhysicsBody>; // id → { x, y, angle, radius }
  isReady: boolean;
}

interface CreateBodyOptions {
  id: string;
  radius: number;
  x?: number;
  y?: number;
  restitution?: number; // default: 0.3
  friction?: number; // default: 0.1
  frictionAir?: number; // default: 0.02
  density?: number; // default: 0.001
  initiativeId?: string; // for grouping
}

interface PhysicsEngineOptions {
  edgeAttractionFilter?: (id: string) => boolean;
}
```

**Lifecycle**:
1. Initialize engine, walls, mouse constraint on container mount
2. Apply forces each beforeUpdate tick
3. Update body positions each afterUpdate tick → setState
4. Component renders with bodies map
5. Cleanup: Engine.clear, World.remove, stop runner

**Used By**: FormingBlocksColumn, SessionsPhysicsColumn (dashboard)

---

### useBlocks
**File**: `/packages/ideation-ui/src/hooks/useBlocks.ts`

Fetch blocks + real-time SSE updates + mutations.

**Features**:
- Initial fetch: `GET /api/ideation/sessions/{sessionId}/blocks`
- SSE subscription: `EventSource('/api/ideation/sessions/{sessionId}/events')`
- Auto-reconnect with exponential backoff (max 5 attempts)
- Handles block events: `session:block_*`
- Optimistic updates (SSE provides new state)

**Mutations**:
- `curateBlock(blockId)` — POST to `/blocks/{id}/curate`
- `uncurateBlock(blockId)` — PATCH status to 'ready'
- `updateBlock(blockId, updates)` — PATCH block fields
- `deleteBlock(blockId)` — DELETE block

**API**:
```typescript
interface UseBlocksReturn {
  blocks: Block[];
  loading: boolean;
  error: Error | null;
  curateBlock: (blockId: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  uncurateBlock: (blockId: string) => Promise<void>;
  updateBlock: (blockId: string, updates: Partial<Block>) => Promise<void>;
  refetch: () => Promise<void>;
}
```

**Used By**: CanvasPage, focus mode content changes

---

### useSession
**File**: `/packages/ideation-ui/src/hooks/useSession.ts`

Fetch single session + metadata.

**Features**:
- GET `/api/ideation/sessions/{sessionId}`
- Returns session with: id, source, status, transcript, updated_at, etc.
- Error + loading states
- Refetch method

---

### useSessions
**File**: `/packages/ideation-ui/src/hooks/useSessions.ts`

Fetch all sessions sorted by recency.

**Features**:
- GET `/api/ideation/sessions`
- Sorted descending by `updated_at`
- Loading + error states
- Refetch method

---

### useSendMessage
**File**: `/packages/ideation-ui/src/hooks/useSendMessage.ts`

Send message with optional block context.

**Features**:
- POST `/api/ideation/sessions/{sessionId}/messages`
- Payload: `{ content, focusedBlockId? }`
- Sending state
- Error handling

---

### useSessionEvents
**File**: `/packages/ideation-ui/src/hooks/useSessionEvents.ts`

SSE subscription for real-time session updates.

**Events**:
- `transcript` — new messages array
- `status` — session status change
- `understanding` — specialist understanding updates
- `blocks` — block array changes

**API**:
```typescript
interface UseSessionEventsCallbacks {
  onTranscript?: (messages: TranscriptMessage[]) => void;
  onStatus?: (status: string) => void;
  onUnderstanding?: (understanding: Record<string, unknown>) => void;
  onBlocks?: (blocks: Block[]) => void;
}

useSessionEvents(sessionId, callbacks);
```

---

### useUnderstanding
**File**: `/packages/ideation-ui/src/hooks/useUnderstanding.ts`

Fetch + subscribe to specialist understanding.

**Features**:
- GET session, extract `understanding` field
- Active specialists extracted from keys
- SSE updates via `useSessionEvents`
- Role hint extraction from observations

**API**:
```typescript
interface UseUnderstandingResult {
  understanding: Record<string, Record<string, unknown>>;
  activeSpecialists: Array<{ name: string; roleHint?: string }>;
  loading: boolean;
}
```

---

### useConfidence
**File**: `/packages/ideation-ui/src/hooks/useConfidence.ts`

Calculate overall + breakdown confidence scores.

**Features**:
- Aggregates specialist confidence levels
- Returns: `{ score: 0-100, breakdown: { specialist: score } }`
- Used for button coloring, progress bars

---

### usePanelState
**File**: `/packages/ideation-ui/src/hooks/usePanelState.ts`

Right panel (Specialists) collapse/expand state.

**Features**:
- localStorage persistence: key `'ideation-panel-collapsed'`
- API: `{ isCollapsed, togglePanel, expandPanel, collapsePanel }`

---

### useMediaQuery
**File**: `/packages/ideation-ui/src/hooks/useMediaQuery.ts`

Detect viewport breakpoints.

**Functions**:
- `useIsMobile()` → boolean (< md breakpoint)
- Can define custom queries

**Usage**: FormingBlocksColumn uses this to disable physics on mobile

---

### useCommandPalette
**File**: `/packages/ideation-ui/src/hooks/useCommandPalette.ts`

Command palette state (search, selection, action execution).

**Features**:
- Receives sessions list
- Generates grouped actions for navigation
- Manages query + selection index
- Execute/select next/previous handlers

---

### useIdeationApi
**File**: `/packages/ideation-ui/src/hooks/useIdeationApi.ts`

Central API client for ideation endpoints.

**Methods**:
- `getSessions()` — list all sessions
- `getSession(id)` — fetch one session
- `createSession(intent)` — start new session
- `updateSession(id, data)` — update metadata
- etc.

---

### useToast
**File**: `/packages/ideation-ui/src/hooks/useToast.ts`

Toast notification system.

**API**: `{ toast: (config) => void }`
- `config.title`, `config.description`, `config.variant` ('success', 'error', etc.)

---

### useTheme
**File**: `/packages/ideation-ui/src/hooks/useTheme.ts`

Theme switching (light/dark).

**API**: `{ theme, setTheme }`

---

### useUserSettings
**File**: `/packages/ideation-ui/src/hooks/useUserSettings.ts`

User preferences (localStorage-backed).

---

## Contexts & State Management

### No explicit Context providers in ideation-ui

State is managed via:
- **useBlocks** — local hook state + SSE
- **useSession** — local hook state + API
- **useSessions** — local hook state + API
- **useSessionEvents** — EventSource subscription
- **usePanelState** — localStorage
- **useUnderstanding** — local hook state + SSE

**URL State** (via react-router):
- Session ID: `/ideation/session/:id`
- Focused block: `?block=:blockId`
- Page: `/ideation` (dashboard), `/canvas` (canvas)

---

## Pages & Routing

### CanvasPage
**File**: `/packages/ideation-ui/src/pages/CanvasPage.tsx`

Main ideation canvas view (3-column layout).

**Route**: `/ideation/session/:id` or `/session/:id/canvas`

**Features**:
- Renders IdeationGridLayout
- Composes: FormingBlocksColumn (left) + SessionChatView (center) + CuratedBlocksColumn (right)
- Focus mode: FocusMode wraps chat when ?block=:id
- Header: SessionNav with title, confidence, AI Understanding, Planner handoff
- Overlays: AIUnderstandingDrawer, HandoffDialog
- Block mutations: curate, update, uncurate
- Session title editing
- Session switching dropdown
- SSE updates via useBlocks + useSession

**State**:
- `focusedBlockId` (local state + URL param sync)
- Blocks array from useBlocks
- Session from useSession
- All sessions from useSessions (for dropdown)

---

### DashboardPage
**File**: `/packages/ideation-ui/src/pages/DashboardPage.tsx`

Meta dashboard with all sessions.

**Route**: `/ideation` (home)

**Features**:
- Renders SessionDashboard component
- Uses same IdeationGridLayout but different content:
  - Left: SessionsPhysicsColumn (sessions as physics blocks)
  - Center: NavigatorChat (meta-chat)
  - Right: SentToPlannerColumn (handoff tracking)
  - Status: IdeationStatusBar

---

### SessionPage
**File**: `/packages/ideation-ui/src/pages/SessionPage.tsx`

Legacy page wrapper (using old IdeationLayout).

**Route**: `/session/:id/*`

**Status**: Marked for cleanup, being replaced by CanvasPage

---

### HomePage
**File**: `/packages/ideation-ui/src/pages/HomePage.tsx`

Legacy home page (marked for cleanup).

---

### MockupPage
**File**: `/packages/ideation-ui/src/pages/MockupPage.tsx`

Development mockup/prototype page.

---

## Shared Components (Specialists, Icons)

### SpecialistsPanel
**File**: `/packages/ideation-ui/src/components/specialists/SpecialistsPanel.tsx`

Right-side panel showing specialist insights.

**Features**:
- Displays active specialists from `useUnderstanding`
- Header with specialist count badge
- SessionConfidenceBar for readiness
- SpecialistCard for each specialist
- Footer: aggregated concerns + questions counts
- Collapse/expand with floating button
- Empty state with helpful message

**Specialist Data Structure**:
```typescript
interface ActiveSpecialist {
  name: string;
  roleHint?: string;
}

// Specialist observations (in understanding):
{
  specialist_name: {
    role?: string;
    roleHint?: string;
    concerns?: string[] | number;
    questions?: string[] | number;
    observations?: Record<string, unknown>;
  }
}
```

---

### SpecialistCard
**File**: `/packages/ideation-ui/src/components/specialists/SpecialistCard.tsx`

Individual specialist insights card.

**Features**:
- Specialist name + role hint
- Concerns list (with AlertIcon)
- Questions list (with HelpCircleIcon)
- Confidence indicator
- Expandable / collapsible

---

### SessionConfidenceBar
**File**: `/packages/ideation-ui/src/components/specialists/SessionConfidenceBar.tsx`

Session-wide readiness bar aggregating all specialists.

**Features**:
- Horizontal segmented bar
- Each specialist = segment
- Color: confidence level → red/yellow/green
- Tooltip on hover

---

### ConfidenceDots, ConfidencePercent, AlertCount, CategoryTag, KeywordTag
**File**: `/packages/ideation-ui/src/components/specialists/*.tsx`

Small indicator components used within specialist cards.

---

### Icons
**File**: `/packages/ideation-ui/src/components/icons/*.tsx`

Custom SVG icons (AlertIcon, BoltIcon, BrainIcon, etc.).

**Pattern**: Accept `size` (sm/md/lg) and `className` props

**Used By**: UI components, specialist cards, navigation

---

## Dashboard Components

### SessionDashboard
**File**: `/packages/ideation-ui/src/components/dashboard/SessionDashboard.tsx`

Wrapper component that assembles dashboard layout.

**Renders**:
- IdeationGridLayout with:
  - DashboardNav (header)
  - SessionsPhysicsColumn (left)
  - NavigatorChat (center)
  - SentToPlannerColumn (right)
  - IdeationStatusBar

---

### SessionsPhysicsColumn
**File**: `/packages/ideation-ui/src/components/dashboard/SessionsPhysicsColumn.tsx`

Left column showing all sessions as physics blocks (dashboard variant).

**Features**:
- Uses usePhysicsEngine with initiative grouping
- SessionPhysicsBlock for each session
- Physics bodies grouped by initiative_id
- Renders count header

**Dependencies**:
- usePhysicsEngine with edgeAttractionFilter for abandoned sessions
- SessionPhysicsBlock components

---

### SessionPhysicsBlock
**File**: `/packages/ideation-ui/src/components/dashboard/SessionPhysicsBlock.tsx`

Session as a physics block (dashboard view).

**Features**:
- Wrapper around PhysicsBlockBase
- Renders session title, status badge, block count
- onClick navigates to canvas
- Abandoned sessions: faded styling + edge attraction

**Uses**: PhysicsBlockBase (shared component)

---

### NavigatorChat
**File**: `/packages/ideation-ui/src/components/dashboard/NavigatorChat.tsx`

Meta-chat interface for dashboard interaction.

**Features**:
- Chat with "Navigator" agent
- System messages, user input, typing indicator
- Optional integration with backend agents

---

### DashboardNav
**File**: `/packages/ideation-ui/src/components/dashboard/DashboardNav.tsx`

Dashboard header with title, logo, actions.

---

## Other Components

### AIUnderstandingDrawer
**File**: `/packages/ideation-ui/src/components/canvas/AIUnderstandingDrawer.tsx`

Slide-out drawer showing synthesized understanding.

**Features**:
- Idea summary (synthesized.idea_summary)
- Specialist perspectives with confidence indicators
- Concerns + insights per specialist
- Close button
- Smooth slide animation

---

### HandoffDialog
**File**: `/packages/ideation-ui/src/components/canvas/HandoffDialog.tsx`

Modal for confirming handoff to planner.

**Features**:
- Block selection checkboxes
- Handoff options (selected blocks, custom title, etc.)
- Confirm/cancel buttons

---

### ModifiedSinceHandoffBanner
**File**: `/packages/ideation-ui/src/components/canvas/ModifiedSinceHandoffBanner.tsx`

Warning banner when session modified after last handoff.

---

### BlockDetailPanel
**File**: `/packages/ideation-ui/src/components/canvas/BlockDetailPanel.tsx`

Detailed view of a single block.

---

### SpecialistPerspectiveCard
**File**: `/packages/ideation-ui/src/components/canvas/SpecialistPerspectiveCard.tsx`

Card showing one specialist's take on a block.

---

### IdeaSummarySection
**File**: `/packages/ideation-ui/src/components/canvas/IdeaSummarySection.tsx`

Summary of synthesized idea across specialists.

---

## Utilities & Libraries

### blockVisibility.ts
**File**: `/packages/ideation-ui/src/components/canvas/utils/blockVisibility.ts`

Confidence-based rendering logic (see [Block Visibility Utils](#block-visibility-utils)).

---

### category-utils.ts
**File**: `/packages/ideation-ui/src/lib/category-utils.ts`

Utilities for categorizing blocks/specialists.

---

### confidence-utils.ts
**File**: `/packages/ideation-ui/src/lib/confidence-utils.ts`

Confidence score calculations.

---

### utils.ts (cn)
**File**: `/packages/ideation-ui/src/lib/utils.ts`

`cn()` classname combiner (from clsx/tailwind utilities).

---

## State Management Patterns

### URL State
- Session ID: route param `/ideation/session/:id`
- Focused block: query param `?block=:blockId`
- Page: route (dashboard, canvas, legacy)

### Local Component State
- Focus mode trigger: `focusedBlockId` (synced with URL)
- Dialog open/closed: `isUnderstandingDrawerOpen`, `isHandoffDialogOpen`
- Panel collapse: via `usePanelState` (localStorage)
- Chat value: `value` in ChatInput

### Server State via Hooks
- Blocks: `useBlocks` → blocks[], loading, error + mutations
- Session: `useSession` → session + metadata
- Sessions list: `useSessions` → sessions[]
- Understanding: `useUnderstanding` → specialist data
- Events: `useSessionEvents` → real-time SSE

### Real-time Updates
- SSE EventSource for `/api/ideation/sessions/:id/events`
- Events: transcript, status, understanding, blocks
- Auto-reconnect with exponential backoff
- Handled by individual hooks (useBlocks, useSessionEvents, etc.)

---

## Animation & Transitions

### CSS Animations (in globals.css)
- `physics-block-pop-in` — entry animation
- `physics-block-pop-out` — exit animation
- `synonym-swap` — text swap
- `session-slide-out` — slide away
- `bounce-dot` — bouncing indicator
- `glow-pulse` — pulse effect

### Tailwind Animations
- `animate-pulse` — ready block glow
- `animate-in fade-in-0 zoom-in-95` — dropdown open
- `slide-in-from-left-2 fade-in` — curated block entry

### RequestAnimationFrame
- PhysicsBlockBase position sync → 60fps smooth motion
- Physics engine updates on each tick

---

## CSS Variables & Theming

### Canvas Theme Variables
- `--canvas-bg` — main background
- `--canvas-bg-subtle` — hover states
- `--canvas-text-primary` — main text
- `--canvas-text-muted` — secondary text
- `--canvas-accent` — action buttons

### Block Theme Variables
- `--block-draft` — forming/emerging block background
- `--block-curated` — curated block background
- `--block-curated-border` — green border for curated
- `--block-draft-border` — border color for forming blocks

### Sidebar Variables
- `--sidebar-width` — typically 280px
- `--specialists-panel-width` — typically 320px

---

## Key Integration Points

### Canvas to Chat
- `SessionChatView` accepts `focusedBlockId` + `focusedBlock` props
- Context banner shows block info
- Messages scoped to block (optional)

### Physics to UI
- `PhysicsBlockBase` syncs physics position → DOM position
- `usePhysicsEngine` manages Matter.js, returns bodies Map
- FormingBlocksColumn maps bodies to block rendering

### Dashboard to Canvas
- SessionsPhysicsColumn renders clickable session blocks
- onClick navigates to `/ideation/session/:id`

### Specialist to Panel
- `useUnderstanding` fetches understanding from session
- `SpecialistsPanel` displays it
- RHS panel in IdeationLayout

### Handoff to Planner
- CanvasPage has handoff dialog
- POST to `/api/ideation/sessions/:id/send-to-planner`
- Sets session as "sent" status

---

## Dependencies Summary

### External Libraries
- `matter-js` — physics engine
- `react-router-dom` — routing
- `lucide-react` — icons
- `clsx` or similar — classname utilities
- `@plannr/shared-ui` — shared components, StatusBar
- Tailwind CSS v4 — styling

### Internal Dependencies
- Hooks: useBlocks, useSession, useSessions, useSessionEvents, useUnderstanding, etc.
- Components: PhysicsBlockBase (shared), UI components (Button, Badge, Dialog, etc.)
- Utils: blockVisibility, confidence-utils, category-utils
- Icons: Custom SVG components

---

## Recommended Reuse for "Tend" App

### Reusable Components (likely 90%+ reusable)
1. **PhysicsBlockBase** — core physics rendering logic
2. **PhysicsBlock** — add confidence styling for "tend" blocks
3. **PhysicsBlocksColumn pattern** — generalize layout
4. **ChatInput, ChatMessageList, ChatBubble** — chat UI (mostly reusable)
5. **FocusMode layout** — detail + chat side-by-side pattern
6. **SessionNav** — header with breadcrumbs, actions
7. **Icons** — reuse or adapt

### Patterns to Adopt
1. **usePhysicsEngine** — reuse for physics simulation
2. **SSE subscription pattern** — use for real-time updates
3. **URL state sync** — use route params for navigation
4. **localStorage for UI state** — use for panel collapse, settings
5. **Motion constraints** — GPU acceleration with transform/will-change

### Components Needing Significant Rework
1. **SpecialistsPanel** → adapt for "tend" expert roles
2. **SessionDashboard** → redesign for unified app flow
3. **AIUnderstandingDrawer** → adapt data structure
4. **HandoffDialog** → replace with "tend" action dialogs

### Architecture to Adapt
1. **IdeationGridLayout** → use same grid pattern
2. **Three-column layout** → LEFT (blocks) | CENTER (chat) | RIGHT (output)
3. **Focus mode** → reuse transition logic
4. **CSS variables** → adapt to "tend" color/spacing scheme

---

## File Organization Summary

```
src/
├── components/
│   ├── canvas/
│   │   ├── IdeationGridLayout.tsx
│   │   ├── FormingBlocksColumn.tsx
│   │   ├── PhysicsBlock.tsx
│   │   ├── CuratedBlocksColumn.tsx
│   │   ├── FocusMode.tsx
│   │   ├── CanvasHeader.tsx (SessionNav)
│   │   ├── IdeationStatusBar.tsx
│   │   ├── AIUnderstandingDrawer.tsx
│   │   ├── HandoffDialog.tsx
│   │   ├── MarkdownEditor.tsx
│   │   └── utils/blockVisibility.ts
│   ├── chat/
│   │   ├── SessionChatView.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessageList.tsx
│   │   ├── ChatBubble.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ConfidenceBar.tsx
│   ├── dashboard/
│   │   ├── SessionDashboard.tsx
│   │   ├── SessionsPhysicsColumn.tsx
│   │   ├── SessionPhysicsBlock.tsx
│   │   ├── NavigatorChat.tsx
│   │   ├── DashboardNav.tsx
│   │   └── SentToPlannerColumn.tsx
│   ├── specialists/
│   │   ├── SpecialistsPanel.tsx
│   │   ├── SpecialistCard.tsx
│   │   ├── SessionConfidenceBar.tsx
│   │   └── (indicators)
│   ├── shared/
│   │   └── PhysicsBlockBase.tsx
│   ├── layout/
│   │   └── IdeationLayout.tsx
│   ├── ui/
│   │   └── (shadcn components)
│   └── icons/
│       └── (custom SVG icons)
├── hooks/
│   ├── usePhysicsEngine.ts
│   ├── useBlocks.ts
│   ├── useSession.ts
│   ├── useSessions.ts
│   ├── useSendMessage.ts
│   ├── useSessionEvents.ts
│   ├── useUnderstanding.ts
│   ├── useConfidence.ts
│   ├── usePanelState.ts
│   ├── useMediaQuery.ts
│   ├── useCommandPalette.ts
│   ├── useIdeationApi.ts
│   ├── useToast.ts
│   ├── useTheme.ts
│   └── useUserSettings.ts
├── lib/
│   ├── blockVisibility.ts
│   ├── confidence-utils.ts
│   ├── category-utils.ts
│   └── utils.ts
├── pages/
│   ├── CanvasPage.tsx
│   ├── DashboardPage.tsx
│   ├── SessionPage.tsx (legacy)
│   ├── HomePage.tsx (legacy)
│   └── MockupPage.tsx
└── App.tsx
```

---

**End of Map**
