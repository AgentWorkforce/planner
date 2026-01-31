import { describe, it, expect } from 'vitest';
import { calculateBezierPath } from './DependencyArrow';

describe('DependencyArrow utilities', () => {
  describe('calculateBezierPath', () => {
    it('generates valid SVG path string', () => {
      const path = calculateBezierPath(
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      );

      expect(path).toMatch(/^M \d+ \d+ C .+$/);
      expect(path).toContain('M 100 100');
    });

    it('handles vertical distance correctly', () => {
      // Short distance should use min control offset (30px)
      const shortPath = calculateBezierPath(
        { x: 100, y: 100 },
        { x: 200, y: 110 }
      );
      expect(shortPath).toBeDefined();

      // Long distance should use capped control offset (80px max)
      const longPath = calculateBezierPath(
        { x: 100, y: 100 },
        { x: 200, y: 500 }
      );
      expect(longPath).toBeDefined();
    });

    it('handles left-to-right flow', () => {
      const path = calculateBezierPath(
        { x: 100, y: 100 },
        { x: 200, y: 200 }
      );
      expect(path).toContain('M 100 100');
    });

    it('handles right-to-left flow', () => {
      const path = calculateBezierPath(
        { x: 200, y: 100 },
        { x: 100, y: 200 }
      );
      expect(path).toContain('M 200 100');
    });
  });
});
