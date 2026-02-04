# usePhysicsEngine Hook

A React hook that provides a matter.js physics engine with zero gravity and central attraction force.

## Features

- Zero gravity with central attraction toward container center
- Collision detection (bodies don't overlap)
- Wall boundaries at container edges
- Circular bodies for collision simplicity
- Memory-safe cleanup on unmount
- Full TypeScript support

## Installation

The hook is already available in the project. Import it from:

```typescript
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
```

## Basic Usage

```typescript
import { useRef } from 'react';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';

function MyComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addBody, removeBody, bodies, isReady } = usePhysicsEngine(containerRef);

  // Add a body when ready
  useEffect(() => {
    if (!isReady) return;

    addBody({
      id: 'my-ball',
      radius: 40,
    });

    return () => removeBody('my-ball');
  }, [isReady]);

  return (
    <div ref={containerRef} className="w-full h-screen relative">
      {Array.from(bodies.values()).map(body => (
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
        >
          <div className="w-full h-full rounded-full bg-blue-500" />
        </div>
      ))}
    </div>
  );
}
```

## API Reference

### Hook Signature

```typescript
function usePhysicsEngine(
  containerRef: RefObject<HTMLElement>
): UsePhysicsEngineReturn
```

### Return Value

```typescript
interface UsePhysicsEngineReturn {
  engine: Engine | null;
  addBody: (options: CreateBodyOptions) => void;
  removeBody: (id: string) => void;
  updateBodyRadius: (id: string, radius: number) => void;
  bodies: Map<string, PhysicsBody>;
  isReady: boolean;
}
```

### CreateBodyOptions

```typescript
interface CreateBodyOptions {
  id: string;              // Unique identifier
  radius: number;          // Circle radius in pixels
  x?: number;             // Spawn X (default: center + random offset)
  y?: number;             // Spawn Y (default: center + random offset)
  restitution?: number;   // Bounciness 0-1 (default: 0.3)
  friction?: number;      // Surface friction (default: 0.1)
  frictionAir?: number;   // Air resistance (default: 0.02)
}
```

### PhysicsBody

```typescript
interface PhysicsBody {
  id: string;
  x: number;      // Center X position
  y: number;      // Center Y position
  angle: number;  // Rotation in radians
  radius: number; // Current radius
}
```

## Methods

### addBody(options)

Adds a new body to the physics world.

```typescript
addBody({
  id: 'ball-1',
  radius: 40,
  x: 200,        // Optional: custom spawn position
  y: 300,        // Optional: custom spawn position
  restitution: 0.5,  // Optional: custom bounciness
});
```

**Warning:** Duplicate IDs will be ignored with a console warning.

### removeBody(id)

Removes a body from the physics world.

```typescript
removeBody('ball-1');
```

**Warning:** Non-existent IDs will trigger a console warning.

### updateBodyRadius(id, radius)

Updates a body's radius (e.g., when size changes).

```typescript
updateBodyRadius('ball-1', 60);
```

Changes smaller than 1px are ignored for performance.

## Physics Behavior

### Central Attraction

Bodies drift toward the container center with a subtle force:
- Force = `0.00008 * body.mass`
- Proportional to mass (all bodies accelerate equally)
- Creates gentle drift, not strong pull

### Collision Detection

- Bodies are circles for efficient collision
- Bodies bounce off each other
- Collision response based on `restitution` (bounciness)

### Wall Boundaries

- Invisible walls at container edges
- 20px thick boundaries
- Bodies bounce off walls

### Zero Gravity

- No global downward force
- Bodies float unless pushed
- Central attraction prevents infinite drift

## Performance Considerations

- Uses `requestAnimationFrame` for smooth 60fps rendering
- Bodies update on every physics tick (16ms)
- Cleanup automatically stops physics engine on unmount
- Collision detection scales with O(n²) - keep bodies < 100

## Examples

See `usePhysicsEngine.example.tsx` for complete working examples:
- Static balls with color coding
- Dynamic add/remove balls
- Interactive size changes

## Testing

The hook includes comprehensive tests covering:
- Initialization and cleanup
- Adding and removing bodies
- Updating body properties
- Spawn position randomization
- Error handling for edge cases

Run tests:
```bash
npm run test:run -- usePhysicsEngine.test.ts
```

## Integration with Existing Mockup

The hook is designed to replace the mockup implementation in:
- `packages/ideation-ui/src/hooks/mockup/usePhysicsEngine.ts`

Key differences:
- More generic API (not tied to Block types)
- Cleaner separation of concerns
- Better TypeScript types
- More comprehensive tests

## Troubleshooting

### Bodies don't appear
- Ensure `containerRef.current` is not null
- Check that `isReady` is true before adding bodies
- Verify container has width/height (not 0)

### Bodies clump in center
- Central attraction force is working correctly
- Add random velocities if you want more spread
- Adjust `ATTRACTION_FORCE` constant in hook source

### Memory leaks
- Always clean up bodies in useEffect return
- Hook automatically stops engine on unmount
- Don't forget to remove event listeners if you add custom ones

### Bodies overlap
- Matter.js collision detection is working
- Check body radii aren't too large for container
- Ensure bodies aren't spawning on top of each other
