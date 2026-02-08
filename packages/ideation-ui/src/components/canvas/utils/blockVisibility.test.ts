/**
 * Tests for block visibility utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getVisibilityLevel,
  getBlockSize,
  isBlockInteractive,
  shouldShowKeyword,
  shouldShowGlow,
  getBlockOpacity,
  getBorderRadius,
  getBorderStyle,
  getEmojiSizeClass,
  getBoxShadow,
} from './blockVisibility';

describe('blockVisibility', () => {
  describe('getVisibilityLevel', () => {
    it('returns forming for confidence < 30%', () => {
      expect(getVisibilityLevel(0)).toBe('forming');
      expect(getVisibilityLevel(15)).toBe('forming');
      expect(getVisibilityLevel(29)).toBe('forming');
    });

    it('returns emerging for confidence 30-59%', () => {
      expect(getVisibilityLevel(30)).toBe('emerging');
      expect(getVisibilityLevel(45)).toBe('emerging');
      expect(getVisibilityLevel(59)).toBe('emerging');
    });

    it('returns developing for confidence 60-89%', () => {
      expect(getVisibilityLevel(60)).toBe('developing');
      expect(getVisibilityLevel(75)).toBe('developing');
      expect(getVisibilityLevel(89)).toBe('developing');
    });

    it('returns ready for confidence >= 90%', () => {
      expect(getVisibilityLevel(90)).toBe('ready');
      expect(getVisibilityLevel(95)).toBe('ready');
      expect(getVisibilityLevel(100)).toBe('ready');
    });
  });

  describe('getBlockSize', () => {
    it('returns 20px for confidence < 30% (forming)', () => {
      expect(getBlockSize(0)).toBe(20);
      expect(getBlockSize(15)).toBe(20);
      expect(getBlockSize(29)).toBe(20);
    });

    it('returns 40-60px for confidence 30-59% (emerging)', () => {
      expect(getBlockSize(30)).toBeCloseTo(40, 1);
      expect(getBlockSize(45)).toBeCloseTo(50, 1);
      expect(getBlockSize(59)).toBeCloseTo(59.43, 1);
    });

    it('returns 60-100px for confidence 60-89% (developing)', () => {
      expect(getBlockSize(60)).toBeCloseTo(60, 1);
      expect(getBlockSize(75)).toBeCloseTo(79.95, 1);
      expect(getBlockSize(89)).toBeCloseTo(98.57, 1);
    });

    it('returns 100px for confidence >= 90% (ready)', () => {
      expect(getBlockSize(90)).toBe(100);
      expect(getBlockSize(95)).toBe(100);
      expect(getBlockSize(100)).toBe(100);
    });

    it('scales linearly within each range', () => {
      // Emerging range: 40-60px over 30-59%
      const size45 = getBlockSize(45);
      const expectedMidpoint = 40 + (45 - 30) * 0.67;
      expect(size45).toBeCloseTo(expectedMidpoint, 1);
    });
  });

  describe('isBlockInteractive', () => {
    it('returns false for confidence < 30% (not clickable)', () => {
      expect(isBlockInteractive(0)).toBe(false);
      expect(isBlockInteractive(15)).toBe(false);
      expect(isBlockInteractive(29)).toBe(false);
    });

    it('returns true for confidence >= 30% (clickable)', () => {
      expect(isBlockInteractive(30)).toBe(true);
      expect(isBlockInteractive(50)).toBe(true);
      expect(isBlockInteractive(75)).toBe(true);
      expect(isBlockInteractive(100)).toBe(true);
    });
  });

  describe('shouldShowKeyword', () => {
    it('returns false when confidence < 60%', () => {
      expect(shouldShowKeyword(30, 100)).toBe(false);
      expect(shouldShowKeyword(59, 100)).toBe(false);
    });

    it('returns false when size < 60px even with high confidence', () => {
      expect(shouldShowKeyword(75, 40)).toBe(false);
      expect(shouldShowKeyword(90, 59)).toBe(false);
    });

    it('returns true when confidence >= 60% and size >= 60px', () => {
      expect(shouldShowKeyword(60, 60)).toBe(true);
      expect(shouldShowKeyword(75, 80)).toBe(true);
      expect(shouldShowKeyword(90, 100)).toBe(true);
    });
  });

  describe('shouldShowGlow', () => {
    it('returns false for confidence < 90%', () => {
      expect(shouldShowGlow(0)).toBe(false);
      expect(shouldShowGlow(50)).toBe(false);
      expect(shouldShowGlow(89)).toBe(false);
    });

    it('returns true for confidence >= 90%', () => {
      expect(shouldShowGlow(90)).toBe(true);
      expect(shouldShowGlow(95)).toBe(true);
      expect(shouldShowGlow(100)).toBe(true);
    });
  });

  describe('getBlockOpacity', () => {
    it('has minimum opacity of 0.3', () => {
      expect(getBlockOpacity(0)).toBe(0.3);
      expect(getBlockOpacity(10)).toBe(0.3);
      expect(getBlockOpacity(30)).toBe(0.3);
    });

    it('scales to 1.0 at 100% confidence', () => {
      expect(getBlockOpacity(100)).toBe(1.0);
    });

    it('scales linearly between 30-100%', () => {
      expect(getBlockOpacity(50)).toBe(0.5);
      expect(getBlockOpacity(75)).toBe(0.75);
    });
  });

  describe('getBorderRadius', () => {
    it('returns rounded-full for forming', () => {
      expect(getBorderRadius('forming')).toBe('9999px');
    });

    it('returns rounded-xl for ready', () => {
      expect(getBorderRadius('ready')).toBe('0.75rem');
    });

    it('returns rounded-2xl for emerging and developing', () => {
      expect(getBorderRadius('emerging')).toBe('1rem');
      expect(getBorderRadius('developing')).toBe('1rem');
    });
  });

  describe('getBorderStyle', () => {
    it('returns minimum values for low confidence', () => {
      const style = getBorderStyle(0);
      expect(style.width).toBe(1);
      expect(style.hue).toBe(60); // Yellow
      expect(style.opacity).toBe(0.1);
    });

    it('returns maximum values for high confidence', () => {
      const style = getBorderStyle(100);
      expect(style.width).toBe(3);
      expect(style.hue).toBe(120); // Green
      expect(style.opacity).toBe(1.0);
    });

    it('transitions from yellow to green', () => {
      const style50 = getBorderStyle(50);
      const style75 = getBorderStyle(75);
      const style100 = getBorderStyle(100);

      expect(style50.hue).toBe(60); // Yellow (starting point)
      expect(style75.hue).toBeGreaterThan(60);
      expect(style100.hue).toBe(120); // Green
    });
  });

  describe('getEmojiSizeClass', () => {
    it('returns text-lg for size < 40px', () => {
      expect(getEmojiSizeClass(20)).toBe('text-lg');
      expect(getEmojiSizeClass(39)).toBe('text-lg');
    });

    it('returns text-2xl for size 40-59px', () => {
      expect(getEmojiSizeClass(40)).toBe('text-2xl');
      expect(getEmojiSizeClass(50)).toBe('text-2xl');
      expect(getEmojiSizeClass(59)).toBe('text-2xl');
    });

    it('returns text-3xl for size >= 60px', () => {
      expect(getEmojiSizeClass(60)).toBe('text-3xl');
      expect(getEmojiSizeClass(80)).toBe('text-3xl');
      expect(getEmojiSizeClass(100)).toBe('text-3xl');
    });
  });

  describe('getBoxShadow', () => {
    it('returns glow shadow when shouldGlow is true', () => {
      const shadow = getBoxShadow(true, 120);
      expect(shadow).toContain('0 0 20px');
      expect(shadow).toContain('hsl(120');
    });

    it('returns default shadow when shouldGlow is false', () => {
      const shadow = getBoxShadow(false, 120);
      expect(shadow).toBe('0 2px 8px rgba(0, 0, 0, 0.08)');
    });
  });

  describe('Progressive revelation integration', () => {
    it('follows the correct progression from forming to ready', () => {
      const testConfidences = [
        { confidence: 15, level: 'forming', size: 20, interactive: false, keyword: false, glow: false },
        { confidence: 35, level: 'emerging', size: 43.35, interactive: true, keyword: false, glow: false },
        { confidence: 70, level: 'developing', size: 73.3, interactive: true, keyword: true, glow: false },
        { confidence: 95, level: 'ready', size: 100, interactive: true, keyword: true, glow: true },
      ];

      testConfidences.forEach(({ confidence, level, size, interactive, keyword, glow }) => {
        expect(getVisibilityLevel(confidence)).toBe(level);
        expect(getBlockSize(confidence)).toBeCloseTo(size, 1);
        expect(isBlockInteractive(confidence)).toBe(interactive);
        expect(shouldShowKeyword(confidence, size)).toBe(keyword);
        expect(shouldShowGlow(confidence)).toBe(glow);
      });
    });
  });
});
