import { useEffect, useRef, useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { Engine, Bodies, Body, Composite, Events, Runner, World } from 'matter-js';

/**
 * Physics body representation
 */
export interface PhysicsBody {
  id: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
}

/**
 * Options for creating a new physics body
 */
export interface CreateBodyOptions {
  id: string;
  radius: number;
  x?: number; // Default: center + random offset
  y?: number; // Default: center + random offset
  restitution?: number; // Bounciness (default: 0.3)
  friction?: number; // Surface friction (default: 0.1)
  frictionAir?: number; // Air resistance (default: 0.02)
  initiativeId?: string; // Optional initiative grouping
}

/**
 * Options for the physics engine
 */
export interface PhysicsEngineOptions {
  /**
   * Filter function to determine which bodies should be attracted to edges
   * Return true to apply edge attraction, false for center attraction
   */
  edgeAttractionFilter?: (id: string) => boolean;
}

/**
 * Return type for usePhysicsEngine hook
 */
export interface UsePhysicsEngineReturn {
  /**
   * Physics engine instance (for advanced use cases)
   */
  engine: Engine | null;

  /**
   * Add a new body to the physics world
   */
  addBody: (options: CreateBodyOptions) => void;

  /**
   * Remove a body from the physics world
   */
  removeBody: (id: string) => void;

  /**
   * Update a body's radius (e.g., when size changes)
   */
  updateBodyRadius: (id: string, radius: number) => void;

  /**
   * Get current positions of all bodies
   */
  bodies: Map<string, PhysicsBody>;

  /**
   * Whether the physics engine is ready
   */
  isReady: boolean;
}

/**
 * Central attraction force strength
 * Lower values = gentle drift toward center
 * Higher values = strong pull toward center
 */
const ATTRACTION_FORCE = 0.00008;

/**
 * Initiative grouping force strength
 * Stronger than central attraction to create distinct wells
 */
const INITIATIVE_FORCE = 0.00015;

/**
 * Edge attraction force strength
 * Used for abandoned sessions drifting to edges
 */
const EDGE_ATTRACTION_FORCE = 0.00012;

/**
 * Random spawn offset from center (pixels)
 */
const SPAWN_OFFSET = 120;

/**
 * usePhysicsEngine
 *
 * A reusable hook for managing a matter.js physics engine with:
 * - Zero gravity
 * - Central attraction force (bodies drift toward container center)
 * - Optional edge attraction force (for abandoned sessions)
 * - Collision detection (bodies don't overlap)
 * - Wall boundaries at container edges
 *
 * Bodies are circles for collision simplicity.
 *
 * @param containerRef - Reference to the container element
 * @param options - Configuration options
 * @returns Physics engine interface
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { addBody, removeBody, bodies } = usePhysicsEngine(containerRef, {
 *   edgeAttractionFilter: (id) => id.startsWith('abandoned-'),
 * });
 *
 * // Add a body
 * addBody({ id: 'block-1', radius: 40 });
 *
 * // Remove a body
 * removeBody('block-1');
 *
 * // Render bodies
 * Array.from(bodies.values()).map(body => (
 *   <div
 *     key={body.id}
 *     style={{
 *       position: 'absolute',
 *       left: body.x - body.radius,
 *       top: body.y - body.radius,
 *       width: body.radius * 2,
 *       height: body.radius * 2,
 *       transform: `rotate(${body.angle}rad)`,
 *     }}
 *   />
 * ));
 * ```
 */
export function usePhysicsEngine(
  containerRef: RefObject<HTMLElement>,
  options?: PhysicsEngineOptions
): UsePhysicsEngineReturn {
  const engineRef = useRef<Engine | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const bodyMapRef = useRef<Map<string, Body>>(new Map());
  const initiativeMapRef = useRef<Map<string, string>>(new Map()); // bodyId -> initiativeId
  const [bodies, setBodies] = useState<Map<string, PhysicsBody>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Store options in ref to prevent re-initialization on option changes
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize physics engine
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Create engine with zero gravity
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    // Add wall boundaries at container edges
    const wallThickness = 20;
    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, {
        isStatic: true,
        label: 'wall-top',
      }),
      Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true,
        label: 'wall-bottom',
      }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        label: 'wall-left',
      }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        label: 'wall-right',
      }),
    ];
    World.add(engine.world, walls);

    // Apply central attraction and initiative grouping forces each frame
    Events.on(engine, 'beforeUpdate', () => {
      const center = { x: width / 2, y: height / 2 };
      const allBodies = Composite.allBodies(engine.world);

      // Calculate initiative centroids (average position of all bodies in each initiative)
      const initiativeCentroids = new Map<string, { x: number; y: number; count: number }>();

      for (const body of allBodies) {
        if (body.isStatic) continue;

        const initiativeId = initiativeMapRef.current.get(body.label);
        if (initiativeId) {
          const existing = initiativeCentroids.get(initiativeId) || { x: 0, y: 0, count: 0 };
          initiativeCentroids.set(initiativeId, {
            x: existing.x + body.position.x,
            y: existing.y + body.position.y,
            count: existing.count + 1,
          });
        }
      }

      // Convert sums to averages
      for (const [id, data] of initiativeCentroids.entries()) {
        if (data.count > 0) {
          initiativeCentroids.set(id, {
            x: data.x / data.count,
            y: data.y / data.count,
            count: data.count,
          });
        }
      }

      // Apply forces to each body
      for (const body of allBodies) {
        // Skip static bodies (walls)
        if (body.isStatic) continue;

        const bodyId = body.label;
        const initiativeId = initiativeMapRef.current.get(bodyId);

        // Check if this body should be attracted to edges
        const shouldAttractToEdge = optionsRef.current?.edgeAttractionFilter?.(bodyId) ?? false;

        if (shouldAttractToEdge) {
          // Edge attraction: pull toward nearest edge
          const distanceToLeft = body.position.x;
          const distanceToRight = width - body.position.x;
          const distanceToTop = body.position.y;
          const distanceToBottom = height - body.position.y;

          // Find nearest edge
          const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

          let targetX = body.position.x;
          let targetY = body.position.y;

          if (minDistance === distanceToLeft) {
            targetX = 40; // Pull to left edge
          } else if (minDistance === distanceToRight) {
            targetX = width - 40; // Pull to right edge
          } else if (minDistance === distanceToTop) {
            targetY = 40; // Pull to top edge
          } else {
            targetY = height - 40; // Pull to bottom edge
          }

          const dx = targetX - body.position.x;
          const dy = targetY - body.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 1) {
            const force = EDGE_ATTRACTION_FORCE * body.mass;
            Body.applyForce(body, body.position, {
              x: (dx / distance) * force,
              y: (dy / distance) * force,
            });
          }
        } else {
          // Initiative grouping force (stronger, attracts to initiative centroid)
          if (initiativeId && initiativeCentroids.has(initiativeId)) {
            const centroid = initiativeCentroids.get(initiativeId)!;
            const dx = centroid.x - body.position.x;
            const dy = centroid.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 1) {
              const force = INITIATIVE_FORCE * body.mass;
              Body.applyForce(body, body.position, {
                x: (dx / distance) * force,
                y: (dy / distance) * force,
              });
            }
          }

          // Central attraction force (weaker, general drift toward center)
          const dx = center.x - body.position.x;
          const dy = center.y - body.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 1) {
            const force = ATTRACTION_FORCE * body.mass;
            Body.applyForce(body, body.position, {
              x: (dx / distance) * force,
              y: (dy / distance) * force,
            });
          }
        }
      }
    });

    // Update body positions after each physics tick
    Events.on(engine, 'afterUpdate', () => {
      const positions = new Map<string, PhysicsBody>();
      bodyMapRef.current.forEach((body, id) => {
        positions.set(id, {
          id,
          x: body.position.x,
          y: body.position.y,
          angle: body.angle,
          radius: (body.bounds.max.x - body.bounds.min.x) / 2,
        });
      });
      setBodies(positions);
    });

    // Start physics simulation
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    setIsReady(true);

    // Cleanup on unmount
    return () => {
      setIsReady(false);
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
        runnerRef.current = null;
      }
      Engine.clear(engine);
      bodyMapRef.current.clear();
      initiativeMapRef.current.clear();
      setBodies(new Map());
    };
  }, [containerRef]);

  // Add a new body to the physics world
  const addBody = useCallback(
    (options: CreateBodyOptions) => {
      const engine = engineRef.current;
      const container = containerRef.current;
      if (!engine || !container || !isReady) return;

      // Skip if body already exists
      if (bodyMapRef.current.has(options.id)) {
        console.warn(`[usePhysicsEngine] Body with id "${options.id}" already exists`);
        return;
      }

      const width = container.offsetWidth;
      const height = container.offsetHeight;

      // Default spawn position: center with random offset
      const x = options.x ?? width / 2 + (Math.random() - 0.5) * SPAWN_OFFSET;
      const y = options.y ?? height / 2 + (Math.random() - 0.5) * SPAWN_OFFSET;

      // Create circular body (chamfer gives rounded corners for rectangles, but we use circles)
      const body = Bodies.circle(x, y, options.radius, {
        restitution: options.restitution ?? 0.3,
        friction: options.friction ?? 0.1,
        frictionAir: options.frictionAir ?? 0.02,
        label: options.id,
      });

      World.add(engine.world, body);
      bodyMapRef.current.set(options.id, body);

      // Store initiative metadata if provided
      if (options.initiativeId) {
        initiativeMapRef.current.set(options.id, options.initiativeId);
      }
    },
    [containerRef, isReady],
  );

  // Remove a body from the physics world
  const removeBody = useCallback(
    (id: string) => {
      const engine = engineRef.current;
      if (!engine) return;

      const body = bodyMapRef.current.get(id);
      if (!body) {
        console.warn(`[usePhysicsEngine] Body with id "${id}" not found`);
        return;
      }

      World.remove(engine.world, body);
      bodyMapRef.current.delete(id);
      initiativeMapRef.current.delete(id); // Clean up initiative metadata
    },
    [],
  );

  // Update a body's radius (e.g., when size changes)
  const updateBodyRadius = useCallback(
    (id: string, radius: number) => {
      const body = bodyMapRef.current.get(id);
      if (!body) {
        console.warn(`[usePhysicsEngine] Body with id "${id}" not found`);
        return;
      }

      const currentRadius = (body.bounds.max.x - body.bounds.min.x) / 2;
      if (Math.abs(radius - currentRadius) < 1) return; // Skip if change is negligible

      const scale = radius / currentRadius;
      Body.scale(body, scale, scale);
    },
    [],
  );

  return {
    engine: engineRef.current,
    addBody,
    removeBody,
    updateBodyRadius,
    bodies,
    isReady,
  };
}
