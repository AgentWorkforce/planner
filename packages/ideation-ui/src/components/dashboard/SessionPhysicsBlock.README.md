# SessionPhysicsBlock Component

Physics-based session block for the ideation dashboard.

## Overview

`SessionPhysicsBlock` renders individual sessions as physics-enabled blocks in the SessionDashboard's left column. Each block represents an active ideation session and shows:

- Session title (truncated)
- Block count badge
- Last activity timestamp

## Architecture

```
SessionsPhysicsColumn (container)
  └── usePhysicsEngine (matter.js integration)
  └── useSessions (data fetching)
  └── SessionPhysicsBlock (per-session renderer)
        ├── Position sync via requestAnimationFrame
        ├── GPU-accelerated transforms
        └── Click navigation to session canvas
```

## Size Calculation

Block size (80-120px) is based on:
- **Block count** (60% weight): More blocks = larger size
- **Recency** (40% weight): Recently updated sessions are more prominent

```typescript
function getSessionSize(blockCount: number, updatedAt: string): number {
  const baseSize = 80;
  const maxSize = 120;

  const blockFactor = Math.min(blockCount / 20, 1);
  const recencyFactor = Math.max(0, 1 - hoursSinceUpdate / 24);

  const sizeFactor = (blockFactor * 0.6 + recencyFactor * 0.4);
  return baseSize + (maxSize - baseSize) * sizeFactor;
}
```

## Physics Behavior

Reuses the same physics engine as FormingBlocksColumn:
- Zero gravity
- Central attraction force (bodies drift toward center)
- Collision detection (bodies don't overlap)
- Wall boundaries at container edges

## Usage

```tsx
import { SessionPhysicsBlock } from '@/components/dashboard';

<SessionPhysicsBlock
  session={{
    id: 'session-123',
    source: { initial_intent: 'Build a feature' },
    blocks: [{ id: 'b1' }, { id: 'b2' }],
    updated_at: '2026-02-04T10:00:00Z',
  }}
  position={{ x: 100, y: 100 }}
  size={80}
  onClick={() => navigate(`/ideation/sessions/${session.id}`)}
/>
```

## Integration Points

### Data Flow
1. `useSessions()` fetches all sessions from API
2. Filter for `status === 'active'`
3. `usePhysicsEngine()` manages physics bodies
4. `SessionPhysicsBlock` renders each session at physics position

### Navigation
Clicking a session block navigates to:
```
/ideation/sessions/{session.id}
```

This loads the full session canvas view with:
- FormingBlocksColumn (left)
- Chat interface (center)
- CuratedBlocksColumn (right)

## Styling

Uses theme CSS variables from `globals.css`:
- `bg-primary`: Block background
- `border-default`: Block border
- `text-primary`: Title text
- `text-secondary`: Block count text
- `text-muted`: Timestamp text

## Performance

- **requestAnimationFrame**: Smooth position updates synced to display refresh
- **GPU acceleration**: CSS transforms instead of top/left positioning
- **Efficient reconciliation**: Only adds/removes physics bodies when sessions change

## Future Enhancements (V3)

Planned features (not in MVP):
- Initiative gravity wells (group sessions by initiative)
- Drag-to-initiative interaction
- Session health indicators (confidence, specialist activity)
- Multi-select for batch operations
