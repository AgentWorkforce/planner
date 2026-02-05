# Abandoned Session Parking Lot Implementation (cv2-043)

## Overview

Implemented abandoned session parking lot feature for the SessionDashboard. Sessions inactive for more than 7 days visually shrink to tiny dots (~10x10px) and drift toward the edges of the container.

## Implementation Details

### 1. Session Abandonment Detection

**File**: `packages/ideation-ui/src/components/dashboard/SessionsPhysicsColumn.tsx`

```typescript
const ABANDONED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ABANDONED_SIZE = 10; // 10px tiny dot

function isSessionAbandoned(updatedAt: string): boolean {
  const now = new Date().getTime();
  const updated = new Date(updatedAt).getTime();
  const timeSinceUpdate = now - updated;
  return timeSinceUpdate > ABANDONED_THRESHOLD_MS;
}
```

### 2. Dynamic Size Calculation

Modified `getSessionSize()` function to return tiny size for abandoned sessions:

```typescript
function getSessionSize(blockCount: number, updatedAt: string): number {
  // Abandoned sessions are tiny dots
  if (isSessionAbandoned(updatedAt)) {
    return ABANDONED_SIZE;
  }

  // Normal size calculation for active sessions...
}
```

### 3. Physics Engine Edge Attraction

**File**: `packages/ideation-ui/src/hooks/usePhysicsEngine.ts`

Added:
- `PhysicsEngineOptions` interface with `edgeAttractionFilter` callback
- `EDGE_ATTRACTION_FORCE` constant (0.00012)
- Edge attraction logic in physics update loop

The physics engine now accepts an optional `edgeAttractionFilter` function that determines which bodies should be pulled to edges instead of center:

```typescript
export function usePhysicsEngine(
  containerRef: RefObject<HTMLElement>,
  options?: PhysicsEngineOptions
): UsePhysicsEngineReturn {
  // ...
}
```

When `edgeAttractionFilter(bodyId)` returns `true`, the body is attracted to the nearest edge (top, bottom, left, or right) with a target position 40px from the edge.

### 4. SessionPhysicsColumn Integration

The column passes the edge attraction filter to the physics engine:

```typescript
const { addBody, removeBody, updateBodyRadius, bodies, isReady } = usePhysicsEngine(containerRef, {
  edgeAttractionFilter: (id) => {
    const session = activeSessions.find((s) => s.id === id);
    return session ? isSessionAbandoned(session.updated_at) : false;
  },
});
```

Dynamic radius updates ensure sessions shrink when they become abandoned:

```typescript
activeSessions.forEach((session) => {
  if (physicsIds.has(session.id)) {
    const blockCount = session.blocks?.length || 0;
    const newSize = getSessionSize(blockCount, session.updated_at);
    updateBodyRadius(session.id, newSize / 2);
  }
});
```

### 5. Visual Styling for Abandoned Sessions

**File**: `packages/ideation-ui/src/components/dashboard/SessionPhysicsBlock.tsx`

Added `isAbandoned` prop to `SessionPhysicsBlock`:

```typescript
export interface SessionPhysicsBlockProps {
  session: SessionPhysicsBlockData;
  position: { x: number; y: number };
  size: number;
  isAbandoned?: boolean;
  onClick?: () => void;
}
```

Abandoned sessions receive distinct styling:
- Faded appearance: `opacity-40` (normal), `opacity-70` (hover)
- Dimmed background: `bg-bg-secondary/50`
- Subtle border: `border-border-subtle`
- Scale on hover: `hover:scale-150` (make them easier to click)
- No content visible (just a colored dot)

### 6. Tooltip for Reactivation

On hover, abandoned sessions show a tooltip with:
- Full session title
- "Abandoned X days ago" timestamp
- "Click to reactivate" instruction

The tooltip is positioned to the right of the abandoned session dot to avoid covering it.

## User Experience

1. **Active Sessions**: Normal size (80-120px), central attraction, full UI with title/blocks/timestamp
2. **Becoming Abandoned**: After 7 days, sessions smoothly shrink to 10px dots
3. **Abandoned Sessions**: Tiny dots drift to edges, faded appearance, show tooltip on hover
4. **Reactivation**: Click an abandoned session to navigate to it and continue work

## Architecture Benefits

- **Modular**: Edge attraction is an optional physics engine feature, not hardcoded
- **Reusable**: `PhysicsEngineOptions` can support other filtering patterns
- **Performance**: Size updates happen in existing effect, no extra re-renders
- **Accessible**: Tooltip provides context, hover scaling makes tiny dots clickable

## Files Modified

1. `/packages/ideation-ui/src/hooks/usePhysicsEngine.ts`
   - Added `PhysicsEngineOptions` interface
   - Added `EDGE_ATTRACTION_FORCE` constant
   - Implemented edge attraction logic in physics update loop
   - Updated function signature to accept options parameter

2. `/packages/ideation-ui/src/components/dashboard/SessionsPhysicsColumn.tsx`
   - Added `ABANDONED_THRESHOLD_MS` and `ABANDONED_SIZE` constants
   - Added `isSessionAbandoned()` helper function
   - Modified `getSessionSize()` to return tiny size for abandoned sessions
   - Passed `edgeAttractionFilter` to physics engine
   - Added dynamic radius updates for size changes
   - Passed `isAbandoned` prop to SessionPhysicsBlock

3. `/packages/ideation-ui/src/components/dashboard/SessionPhysicsBlock.tsx`
   - Added `isAbandoned` prop to component interface
   - Added tooltip state management
   - Implemented conditional styling for abandoned sessions
   - Added tooltip with session info and reactivation hint

## Testing Notes

- TypeScript compilation passes with no errors
- Physics engine correctly applies edge attraction based on filter
- Sessions smoothly transition from active to abandoned state
- Tooltip appears/disappears correctly on hover
- Click navigation works for both active and abandoned sessions
