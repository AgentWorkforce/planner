import { useEffect, useRef, useState } from 'react';
import {
  Body,
  Bodies,
  Composite,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Runner,
  World,
} from 'matter-js';
import type { RefObject } from 'react';
import type { Block, BlockPosition } from '@/lib/mockup/block-utils';

interface UsePhysicsEngineOptions {
  containerRef: RefObject<HTMLDivElement>;
  blocks: Block[];
  onBlocksUpdate: (positions: Map<string, BlockPosition>) => void;
}

interface UsePhysicsEngineReturn {
  bodyMap: Map<string, Body>;
  isReady: boolean;
}

export function usePhysicsEngine({ containerRef, blocks, onBlocksUpdate }: UsePhysicsEngineOptions): UsePhysicsEngineReturn {
  const engineRef = useRef<Engine | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const mouseConstraintRef = useRef<MouseConstraint | null>(null);
  const bodyMapRef = useRef<Map<string, Body>>(new Map());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    const walls = [
      Bodies.rectangle(width / 2, -10, width, 20, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true, label: 'wall' }),
    ];
    World.add(engine.world, walls);

    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });
    mouseConstraintRef.current = mouseConstraint;
    World.add(engine.world, mouseConstraint);

    Events.on(engine, 'beforeUpdate', () => {
      const center = { x: width / 2, y: height / 2 };
      const bodies = Composite.allBodies(engine.world);

      for (const body of bodies) {
        if (body.isStatic || body.label === 'wall') continue;

        const dx = center.x - body.position.x;
        const dy = center.y - body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) continue;

        const force = 0.00008 * body.mass;
        Body.applyForce(body, body.position, {
          x: (dx / distance) * force,
          y: (dy / distance) * force,
        });
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Events.on(mouseConstraint, 'enddrag', (event: any) => {
      const draggedBody = event.body as Body | undefined;
      const bodies = Composite.allBodies(engine.world);
      for (const body of bodies) {
        if (body.isStatic || body === draggedBody) continue;
        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * 0.001,
          y: (Math.random() - 0.5) * 0.001,
        });
      }
    });

    Events.on(engine, 'afterUpdate', () => {
      const positions = new Map<string, BlockPosition>();
      bodyMapRef.current.forEach((body, id) => {
        positions.set(id, {
          x: body.position.x,
          y: body.position.y,
          angle: body.angle,
        });
      });
      onBlocksUpdate(positions);
    });

    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    setIsReady(true);

    return () => {
      setIsReady(false);
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
        runnerRef.current = null;
      }
      if (mouseConstraintRef.current) {
        World.remove(engine.world, mouseConstraintRef.current);
        mouseConstraintRef.current = null;
      }
      Engine.clear(engine);
      bodyMapRef.current.clear();
    };
  }, [containerRef, onBlocksUpdate]);

  useEffect(() => {
    const engine = engineRef.current;
    const container = containerRef.current;
    if (!engine || !container || !isReady) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    for (const block of blocks) {
      if (block.status !== 'draft') continue;
      if (bodyMapRef.current.has(block.id)) continue;

      const size = 40 + block.maturity * 0.6;
      const body = Bodies.rectangle(
        width / 2 + (Math.random() - 0.5) * 120,
        height / 2 + (Math.random() - 0.5) * 120,
        size,
        size,
        {
          restitution: 0.3,
          friction: 0.1,
          frictionAir: 0.02,
          chamfer: { radius: 8 },
          label: block.id,
        },
      );
      World.add(engine.world, body);
      bodyMapRef.current.set(block.id, body);
    }

    for (const [id, body] of bodyMapRef.current) {
      const block = blocks.find((b) => b.id === id);
      if (!block || block.status !== 'draft') {
        World.remove(engine.world, body);
        bodyMapRef.current.delete(id);
      }
    }

    for (const block of blocks) {
      if (block.status !== 'draft') continue;
      const body = bodyMapRef.current.get(block.id);
      if (!body) continue;

      const newSize = 40 + block.maturity * 0.6;
      const currentSize = body.bounds.max.x - body.bounds.min.x;
      if (Math.abs(newSize - currentSize) > 1) {
        const scale = newSize / currentSize;
        Body.scale(body, scale, scale);
      }
    }
  }, [blocks, containerRef, isReady]);

  return {
    bodyMap: bodyMapRef.current,
    isReady,
  };
}
