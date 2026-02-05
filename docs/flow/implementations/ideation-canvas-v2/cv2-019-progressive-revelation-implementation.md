# Progressive Revelation Implementation (cv2-019)

## Overview

Implemented a progressive disclosure UX system where blocks appear and grow based on confidence thresholds. This creates a natural visual hierarchy that guides user attention to the most confident ideas.

## Implementation Summary

### Files Created/Modified

1. **Created**: `packages/ideation-ui/src/components/canvas/utils/blockVisibility.ts`
   - Core utility functions for progressive revelation
   - All visibility logic centralized and testable

2. **Modified**: `packages/ideation-ui/src/components/canvas/PhysicsBlock.tsx`
   - Integrated visibility utilities
   - Implemented progressive size scaling
   - Added interactivity gating
   - Added glow effects for ready blocks

3. **Modified**: `packages/ideation-ui/src/components/canvas/FormingBlocksColumn.tsx`
   - Updated to use centralized `getBlockSize` utility
   - Removed duplicate size calculation logic

4. **Modified**: `packages/ideation-ui/src/globals.css`
   - Added `glow-pulse` keyframe animation
   - Added `.block-glow` class

5. **Modified**: `packages/ideation-ui/src/components/mockup/mockup-theme.css`
   - Added `--canvas-accent-rgb` variable for glow effects

6. **Created**: `packages/ideation-ui/src/components/canvas/utils/blockVisibility.test.ts`
   - Comprehensive test coverage (31 tests, all passing)

## Visibility Thresholds

| Confidence | Level       | Size      | Interactivity | Content Display          | Visual Effect |
|------------|-------------|-----------|---------------|--------------------------|---------------|
| 0-29%      | Forming     | 20px      | Not clickable | Tiny dot only            | None          |
| 30-59%     | Emerging    | 40-60px   | Clickable     | Emoji only               | None          |
| 60-89%     | Developing  | 60-100px  | Clickable     | Emoji + keyword          | None          |
| 90-100%    | Ready       | 100px     | Clickable     | Emoji + keyword          | Glow/pulse    |

## Key Features

### 1. Progressive Size Scaling

Blocks grow smoothly from tiny dots (20px) to full size (100px) as confidence increases:

```typescript
// Linear interpolation within each range
if (confidence < 30) return 20;
if (confidence < 60) return 40 + (confidence - 30) * 0.67; // 40-60
if (confidence < 90) return 60 + (confidence - 60) * 1.33; // 60-100
return 100;
```

### 2. Interactivity Gating

Blocks below 30% confidence are not interactive:
- No click events
- No drag interaction
- `pointer-events-none` CSS class
- Visual indicator: no hover effects

### 3. Content Progressive Disclosure

Content reveals progressively:
- **Forming (0-29%)**: Small dot indicator only
- **Emerging (30-59%)**: Emoji appears
- **Developing (60-89%)**: Keyword text appears (if size permits)
- **Ready (90%+)**: Full content + glow effect

### 4. Glow Effect for Ready Blocks

Blocks at 90%+ confidence show a pulsing glow:
- 2-second ease-in-out animation
- Uses theme accent color
- Indicates block is ready for curation

### 5. Responsive Emoji Sizing

Emoji size scales with block size:
- Small blocks (< 40px): `text-lg`
- Medium blocks (40-59px): `text-2xl`
- Large blocks (60px+): `text-3xl`

### 6. Border Color Gradient

Border color transitions from yellow (low confidence) to green (high confidence):
- Hue: 60° (yellow) → 120° (green)
- Opacity: 10% → 100%
- Width: 1px → 3px

## Usage Example

```tsx
import { PhysicsBlock } from '@/components/canvas/PhysicsBlock';

<PhysicsBlock
  block={{
    id: 'block-1',
    emoji: '💡',
    keyword: 'Innovation',
    confidence: 75, // 75% confidence
    status: 'developing',
  }}
  position={{ x: 100, y: 100 }}
  size={75} // Size calculated from confidence
  onClick={() => handleBlockClick('block-1')}
/>
```

## Testing

Comprehensive test suite with 31 tests covering:
- Visibility level detection
- Size calculation
- Interactivity gating
- Keyword display logic
- Glow effect triggers
- Opacity scaling
- Border styling
- Integration scenarios

Run tests:
```bash
cd packages/ideation-ui
npm test -- blockVisibility.test.ts
```

## CSS Animation

The glow effect uses a custom keyframe animation:

```css
@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 15px rgba(var(--canvas-accent-rgb), 0.3);
  }
  50% {
    box-shadow: 0 0 25px rgba(var(--canvas-accent-rgb), 0.5);
  }
}
```

Applied via Tailwind's `animate-pulse` class when confidence >= 90%.

## Acceptance Criteria

✅ Blocks below 30% confidence render as tiny dots (~20px, not interactive)
✅ Blocks at 30-60% render smaller (40-60px)
✅ Blocks at 60-90% render full size (60-100px)
✅ Blocks at 90%+ add glow/pulse effect

## Design Rationale

### Why these thresholds?

- **30%**: Minimum confidence to be considered "real" enough to interact with
- **60%**: High enough to show full content without overwhelming the canvas
- **90%**: Clear signal that AI is highly confident, ready for human curation

### Why linear interpolation?

Smooth size transitions create a more natural, less "steppy" feel. Blocks grow gradually rather than jumping between fixed sizes.

### Why gate interactivity?

Prevents accidental clicks on barely-formed ideas. Forces user attention on more confident blocks.

## Future Enhancements

Potential improvements for future iterations:

1. **Animation on threshold crossing**: Smooth transition when block crosses threshold (e.g., 29% → 30%)
2. **Confidence-based opacity**: Additional visual indicator beyond size
3. **Pulse rate scaling**: Faster pulse for 95%+ confidence vs. 90%
4. **Color coding**: Different accent colors per confidence tier
5. **Tooltip hints**: "Still forming..." for < 30%, "Ready to curate!" for 90%+

## Related Steps

- **cv2-004**: PhysicsBlock component foundation
- **cv2-005**: FormingBlocksColumn component
- **cv2-020**: Block size based on content (text length)
- **cv2-030**: Curate action with animation

## Files Reference

All modified files with absolute paths:

- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/components/canvas/utils/blockVisibility.ts`
- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/components/canvas/PhysicsBlock.tsx`
- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/components/canvas/FormingBlocksColumn.tsx`
- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/globals.css`
- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/components/mockup/mockup-theme.css`
- `/Users/flysikring/conductor/workspaces/plannr/algiers/packages/ideation-ui/src/components/canvas/utils/blockVisibility.test.ts`
