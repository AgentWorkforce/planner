# Ideation UI

React frontend for AI-powered brainstorming sessions with physics-based visualization.

## Setup

```bash
npm install
npm run dev  # Starts on http://localhost:3002
```

Requires backend API running on port 3001.

## Key Features

- Interactive brainstorming sessions with AI specialists
- Physics-based idea visualization using Matter.js
- Drag-and-drop interaction with physics constraints
- Real-time AI suggestions and refinements
- Initiative wells for grouping related ideas
- Abandoned idea drift to edges
- Canvas mode for immersive full-screen experience
- Command palette for navigation (Cmd+K)
- Session confidence tracking
- Handoff to Planner for implementation

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | DashboardPage | Sessions overview with physics |
| `/ideation` | DashboardPage | Same as `/` |
| `/ideation/session/:id` | CanvasPage | Full-screen canvas mode |
| `/session/:id/canvas` | CanvasPage | Full-screen canvas mode |
| `/session/:id/*` | SessionPage | Legacy session view |
| `/mockup` | MockupPage | Design mockups |
| `/legacy` | HomePage | Legacy home page |

## Key Components

**Dashboard**
- `SessionDashboard` - Main dashboard with physics visualization
- `SessionPhysicsBlock` - Session card with physics body
- `SessionsPhysicsColumn` - Column containing physics blocks
- `InitiativeWells` - Initiative grouping with gravity wells
- `SentToPlannerColumn` - Completed sessions sent to planner
- `NavigatorChat` - Chat interface for creating sessions
- `DashboardNav` - Top navigation bar

**Canvas**
- `CanvasPage` - Full-screen immersive mode
- `FormingBlocksColumn` - Forming ideas with physics
- `CuratedBlocksColumn` - Approved idea blocks
- `PhysicsBlock` - Interactive block with Matter.js body
- `BlockDetailPanel` - Detailed block view
- `AIUnderstandingDrawer` - AI understanding of session
- `FocusMode` - Distraction-free editing
- `CanvasHeader` - Canvas toolbar
- `IdeationStatusBar` - Session status and confidence
- `HandoffDialog` - Handoff to Planner dialog

**Chat**
- `SessionChatView` - Chat interface with specialists
- `ChatBubble` - Message bubble
- `ChatInput` - Message input with controls
- `ChatMessageList` - Message history
- `TypingIndicator` - AI typing indicator
- `ConfidenceBar` - Confidence visualization

**Specialists**
- `SpecialistCard` - AI specialist profile
- `SpecialistsPanel` - Right panel with specialists
- `SpecialistPerspectiveCard` - Specialist insights
- `ConfidenceDots` - Visual confidence indicator
- `ConfidencePercent` - Percentage display
- `AlertCount` - Unread alerts badge

**Sessions**
- `SessionList` - List of sessions
- `SessionItem` - Session list item
- `NewSessionButton` - Create session button
- `NewSessionModal` - Create session dialog
- `SessionStatusBadge` - Status indicator

**Layout**
- `IdeationLayout` - Main layout with sidebar + panel
- `Sidebar` - Left navigation sidebar
- `MainHeader` - Top header bar

**UI Components**
- `CommandPalette` - Keyboard navigation
- `Toaster` - Toast notifications
- `Button` - Standard button component
- `Dialog` - Modal dialogs
- `Tooltip` - Tooltips
- `Badge` - Status badges
- `LoadingSpinner` - Loading states
- `Skeleton` - Loading placeholders

## Key Hooks

**Physics Engine**
- `usePhysicsEngine` - Matter.js physics simulation with central/edge attraction
  - Zero gravity environment
  - Central attraction force (bodies drift to center)
  - Edge attraction for abandoned sessions
  - Initiative grouping force (wells)
  - Collision detection and wall boundaries
  - Drag interaction support

**Session Data**
- `useSessions` - All sessions
- `useSession` - Single session by ID
- `useSessionEvents` - SSE for session updates
- `useBlocks` - Idea blocks in session
- `useUnderstanding` - AI understanding of session

**UI State**
- `usePanelState` - Specialists panel collapse state
- `useCommandPalette` - Command palette state
- `useMediaQuery` - Responsive breakpoints
- `useTheme` - Dark/light theme

**API**
- `useIdeationApi` - API client with auto-retry
- `useSendMessage` - Send chat messages
- `useInitiatives` - Fetch initiatives

**Utilities**
- `useConfidence` - Confidence calculations
- `useUserSettings` - User preferences
- `useToast` - Toast notifications

## Physics Engine

The `usePhysicsEngine` hook manages Matter.js physics simulation:

```tsx
const { addBody, removeBody, updateBodyRadius, bodies } = usePhysicsEngine(
  containerRef,
  {
    edgeAttractionFilter: (id) => id.startsWith('abandoned-'),
  }
);

// Add a body
addBody({
  id: 'session-1',
  radius: 60,
  initiativeId: 'init-1' // Groups with other bodies in same initiative
});

// Render bodies
Array.from(bodies.values()).map(body => (
  <div
    key={body.id}
    style={{
      position: 'absolute',
      left: body.x - body.radius,
      top: body.y - body.radius,
      width: body.radius * 2,
      height: body.radius * 2,
      transform: `rotate(${body.angle}rad)`,
    }}
  />
));
```

**Forces:**
- Central attraction: Gentle drift toward container center
- Initiative force: Stronger pull toward initiative centroid (creates wells)
- Edge attraction: Pull abandoned sessions to edges
- Collision: Bodies bounce off each other and container walls

## Design System

Uses Tailwind CSS v4 with custom color scales and shadcn/ui components. Dark mode default with OS preference support.

## Scripts

```bash
npm run dev        # Dev server (port 3002)
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run tests with Vitest
npm run test:run   # Run tests once (CI)
npm run typecheck  # TypeScript type checking
```

## Architecture

- **Matter.js** for physics simulation
- **React Markdown** for rendering AI responses
- **SSE** for real-time session updates
- **WebSocket** for relay messaging (future)
- **Vite** for fast dev server and HMR
