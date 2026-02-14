/**
 * Animation Frames
 *
 * Pure data definitions for all status bar animations.
 * Inspired by sindresorhus/cli-spinners — precomputed frames
 * played back at a defined interval. No logic, just data.
 */

export interface Animation {
  /** Milliseconds between frames. 0 = static (no timer). */
  interval: number;
  /** Frame strings to cycle through. */
  frames: readonly string[];
}

// ---------------------------------------------------------------------------
// Spinner animations (position 1 of the 7-char agent indicator)
// ---------------------------------------------------------------------------

export const SPINNERS = {
  /** Braille spinner — smooth rotation */
  dots: {
    interval: 80,
    frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  },
  /** ASCII line spinner — guaranteed single-width in monospace fonts */
  line: {
    interval: 120,
    frames: ['/', '-', '\\', '|'],
  },
  /** Rotating arc */
  arc: {
    interval: 100,
    frames: ['◜', '◠', '◝', '◞', '◡', '◟'],
  },
  /** Box-drawing rotation */
  pipe: {
    interval: 100,
    frames: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'],
  },
} as const satisfies Record<string, Animation>;

// ---------------------------------------------------------------------------
// Fill animations (positions 5-7 of the 7-char agent indicator)
// ---------------------------------------------------------------------------

export const FILLS = {
  // -- Working with known progress --
  'working:0': {
    interval: 600,
    frames: ['░░░', '▒░░', '░░░'],
  },
  'working:33': {
    interval: 400,
    frames: ['█░░', '▓░░'],
  },
  'working:66': {
    interval: 400,
    frames: ['██░', '█▓░'],
  },
  'working:100': {
    interval: 0,
    frames: ['███'],
  },

  // -- Working without progress (indeterminate) --
  'working:indeterminate': {
    interval: 150,
    frames: ['█··', '·█·', '··█', '·█·'],
  },

  // -- Static states --
  normal: {
    interval: 0,
    frames: ['---'],
  },
  idle: {
    interval: 0,
    frames: ['···'],
  },

  // -- Needs input — blink speed encodes urgency --
  'needs_input:blocking': {
    interval: 500,
    frames: ['▓▓▓', '░░░'],
  },
  'needs_input:normal': {
    interval: 800,
    frames: ['▓░░', '░░░'],
  },
  'needs_input:fyi': {
    interval: 0,
    frames: ['░░░'],
  },

  // -- Error — slow ominous pulse --
  error: {
    interval: 1000,
    frames: ['×××', '···'],
  },
} as const satisfies Record<string, Animation>;

// ---------------------------------------------------------------------------
// State character (position 1) for non-animated states
// ---------------------------------------------------------------------------

export const STATE_CHARS: Record<string, string> = {
  normal: '·',
  idle: ' ',
  needs_input: '?',
  error: '!',
};

// ---------------------------------------------------------------------------
// StatusBar content wipes — one-shot transitions between content types.
// Each frame is a single character repeated to fill the status bar width.
// Intensity (block density) and speed scale with urgency.
// ---------------------------------------------------------------------------

export const WIPES = {
  // --- Routine wipes (content transitions) ---

  /** Gentle — returning to agents view, info messages */
  gentle: {
    interval: 60,
    frames: ['·', '░', '·'],
  },
  /** Normal — progress bars, warnings */
  normal: {
    interval: 50,
    frames: ['░', '▒', '░'],
  },
  /** Urgent — alerts, errors */
  urgent: {
    interval: 35,
    frames: ['▒', '█', '▒'],
  },

  // --- Special wipes (milestone events, 2-3× duration) ---

  /** Celebrate — phase completion, success milestones */
  celebrate: {
    interval: 50,
    frames: ['░', '▒', '▓', '█', '▓', '▒', '░'],
  },
  /** Error — system errors, failures */
  error: {
    interval: 55,
    frames: ['·', '×', '·', '×', '·'],
  },
  /** Phase — phase transitions, major state changes */
  phase: {
    interval: 45,
    frames: ['░', '▓', '█', '▓', '░', '▓', '█', '▓', '░'],
  },
} as const satisfies Record<string, Animation>;

export type WipeLevel = keyof typeof WIPES;

// ---------------------------------------------------------------------------
// StatusBar progress bar — leading edge pulse
// ---------------------------------------------------------------------------

export const PROGRESS_EDGE: Animation = {
  interval: 300,
  frames: ['█', '▓'],
};

// ---------------------------------------------------------------------------
// Activity scroll — marquee text within a fixed-width window
// ---------------------------------------------------------------------------

/**
 * Build frames that scroll text through a fixed-width window.
 * Text is uppercased. If it fits, a single static frame is returned.
 * Otherwise, creates a right-to-left marquee with a gap separator.
 */
export function buildScrollFrames(text: string, width: number): Animation {
  const upper = text.toUpperCase();
  if (upper.length <= width) {
    return { interval: 0, frames: [upper.padEnd(width, '·')] };
  }
  // Marquee: scroll right-to-left with gap
  const padded = upper + '···';
  const frames: string[] = [];
  for (let i = 0; i < padded.length; i++) {
    frames.push((padded + upper).slice(i, i + width));
  }
  return { interval: 200, frames };
}
