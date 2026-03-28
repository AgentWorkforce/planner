/**
 * Example usage of usePhysicsEngine hook
 *
 * This file demonstrates how to use the physics engine hook
 * to create interactive physics-based components.
 */

import { useRef, useEffect } from 'react';
import { usePhysicsEngine } from './usePhysicsEngine';

interface Ball {
  id: string;
  color: string;
  size: number;
}

export function PhysicsExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addBody, removeBody, updateBodyRadius, bodies, isReady } = usePhysicsEngine(containerRef);

  const balls: Ball[] = [
    { id: 'ball-1', color: '#ff6b6b', size: 40 },
    { id: 'ball-2', color: '#4ecdc4', size: 50 },
    { id: 'ball-3', color: '#45b7d1', size: 35 },
    { id: 'ball-4', color: '#f7b731', size: 45 },
    { id: 'ball-5', color: '#5f27cd', size: 38 },
  ];

  // Add balls when engine is ready
  useEffect(() => {
    if (!isReady) return;

    balls.forEach((ball) => {
      addBody({
        id: ball.id,
        radius: ball.size,
        // Optional: custom spawn position
        // x: 100,
        // y: 200,
      });
    });

    // Cleanup: remove balls on unmount
    return () => {
      balls.forEach((ball) => removeBody(ball.id));
    };
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Example: dynamically update ball size
  const handleGrowBall = (id: string) => {
    const ball = balls.find((b) => b.id === id);
    if (ball) {
      updateBodyRadius(id, ball.size * 1.2);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="p-4 bg-gray-100 flex gap-2">
        <button
          onClick={() => handleGrowBall('ball-1')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Grow Red Ball
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100"
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Initializing physics...
          </div>
        )}

        {Array.from(bodies.values()).map((body) => {
          const ball = balls.find((b) => b.id === body.id);
          if (!ball) return null;

          return (
            <div
              key={body.id}
              className="absolute cursor-pointer transition-all"
              style={{
                left: body.x - body.radius,
                top: body.y - body.radius,
                width: body.radius * 2,
                height: body.radius * 2,
                transform: `rotate(${body.angle}rad)`,
              }}
              onClick={() => handleGrowBall(body.id)}
            >
              <div
                className="w-full h-full rounded-full shadow-lg flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: ball.color }}
              >
                {Math.round(body.radius * 2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Advanced example: Dynamic body management
 */
export function DynamicPhysicsExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addBody, removeBody, bodies, isReady } = usePhysicsEngine(containerRef);
  const nextIdRef = useRef(1);

  const handleAddBall = () => {
    const id = `dynamic-${nextIdRef.current++}`;
    addBody({
      id,
      radius: 20 + Math.random() * 30,
      // Spawn at random position
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 400,
    });
  };

  const handleRemoveBall = (id: string) => {
    removeBody(id);
  };

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="p-4 bg-gray-100 flex gap-2">
        <button
          onClick={handleAddBall}
          disabled={!isReady}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
        >
          Add Ball
        </button>
        <span className="flex items-center text-sm text-gray-600">
          {bodies.size} ball{bodies.size !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative bg-gradient-to-br from-purple-50 to-blue-50"
      >
        {Array.from(bodies.values()).map((body) => (
          <div
            key={body.id}
            className="absolute cursor-pointer group"
            style={{
              left: body.x - body.radius,
              top: body.y - body.radius,
              width: body.radius * 2,
              height: body.radius * 2,
              transform: `rotate(${body.angle}rad)`,
            }}
            onClick={() => handleRemoveBall(body.id)}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg flex items-center justify-center text-white text-xs font-semibold group-hover:ring-2 ring-purple-600 transition">
              {body.id.split('-')[1]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
