import { useState, useEffect, useRef } from 'react';
import type { Animation } from '@/components/status/animation-frames';

/**
 * useFramePlayer
 *
 * Generic hook that cycles through animation frames at a given interval.
 * When interval is 0 or there's only one frame, no timer is created.
 * Returns the current frame string.
 */
export function useFramePlayer(animation: Animation): string {
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track animation identity to reset frame index on change
  const prevAnimRef = useRef(animation);

  useEffect(() => {
    // Reset frame index when animation changes
    if (prevAnimRef.current !== animation) {
      setFrameIndex(0);
      prevAnimRef.current = animation;
    }

    // Clean up any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Static animation — no timer needed
    if (animation.interval === 0 || animation.frames.length <= 1) {
      return;
    }

    // Start cycling
    intervalRef.current = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % animation.frames.length);
    }, animation.interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [animation]);

  return animation.frames[frameIndex % animation.frames.length] ?? animation.frames[0] ?? '';
}
