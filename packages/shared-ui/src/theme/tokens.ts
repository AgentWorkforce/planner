/**
 * Mission Control Design System - TypeScript Design Tokens
 *
 * Programmatic access to design tokens for use in components and styling.
 * These match the CSS variables defined in styles/tokens.css.
 */

// ===== Color Tokens =====

export const colors = {
  bg: {
    deep: "var(--color-bg-deep)",
    primary: "var(--color-bg-primary)",
    secondary: "var(--color-bg-secondary)",
    tertiary: "var(--color-bg-tertiary)",
    card: "var(--color-bg-card)",
    elevated: "var(--color-bg-elevated)",
    hover: "var(--color-bg-hover)",
    active: "var(--color-bg-active)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
    dim: "var(--color-text-dim)",
    inverse: "var(--color-text-inverse)",
  },
  border: {
    default: "var(--color-border-default)",
    subtle: "var(--color-border-subtle)",
    light: "var(--color-border-light)",
    medium: "var(--color-border-medium)",
  },
  accent: {
    cyan: "var(--color-accent-cyan)",
    orange: "var(--color-accent-orange)",
    purple: "var(--color-accent-purple)",
    green: "var(--color-accent-green)",
    hover: "var(--color-accent-hover)",
    light: "var(--color-accent-light)",
  },
  status: {
    success: "var(--color-success)",
    successLight: "var(--color-success-light)",
    warning: "var(--color-warning)",
    warningLight: "var(--color-warning-light)",
    error: "var(--color-error)",
    errorLight: "var(--color-error-light)",
    info: "var(--color-info)",
    infoLight: "var(--color-info-light)",
    pending: "var(--color-pending)",
    pendingLight: "var(--color-pending-light)",
  },
  presence: {
    online: "var(--color-status-online)",
    offline: "var(--color-status-offline)",
    busy: "var(--color-status-busy)",
    away: "var(--color-status-away)",
  },
  sidebar: {
    bg: "var(--color-sidebar-bg)",
    border: "var(--color-sidebar-border)",
    hover: "var(--color-sidebar-hover)",
  },
} as const;

// Raw color values for non-CSS contexts (charts, canvas, etc.)
export const rawColors = {
  dark: {
    accent: {
      cyan: "#00d9ff",
      orange: "#ff6b35",
      purple: "#a855f7",
      green: "#00ffc8",
    },
    status: {
      success: "#00ffc8",
      warning: "#ff6b35",
      error: "#ff4757",
      info: "#00d9ff",
      pending: "#9ca3af",
    },
  },
  light: {
    accent: {
      cyan: "#0099cc",
      orange: "#e55a2b",
      purple: "#8b44d9",
      green: "#00b894",
    },
    status: {
      success: "#00b894",
      warning: "#e55a2b",
      error: "#e53935",
      info: "#0099cc",
      pending: "#9ca3af",
    },
  },
} as const;

// ===== Typography Tokens =====

export const typography = {
  fontFamily: {
    display: "'Outfit', sans-serif",
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'IBM Plex Mono', 'SF Mono', Consolas, monospace",
  },
  fontSize: {
    xs: "11px",
    sm: "13px",
    base: "14px",
    lg: "15px",
    xl: "16px",
    "2xl": "18px",
    "3xl": "24px",
    "4xl": "32px",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
} as const;

// ===== Spacing Tokens =====

export const spacing = {
  px: "1px",
  0: "0",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  11: "44px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  sidebar: "280px",
  header: "52px",
} as const;

// ===== Border Radius Tokens =====

export const borderRadius = {
  none: "0",
  sm: "4px",
  DEFAULT: "6px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  full: "9999px",
} as const;

// ===== Shadow Tokens =====

export const shadows = {
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  modal: "var(--shadow-modal)",
  glowCyan: "var(--shadow-glow-cyan)",
  glowOrange: "var(--shadow-glow-orange)",
  glowPurple: "var(--shadow-glow-purple)",
  glowGreen: "var(--shadow-glow-green)",
} as const;

// ===== Animation Tokens =====

export const animation = {
  duration: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
  },
  easing: {
    default: "ease",
    linear: "linear",
    in: "ease-in",
    out: "ease-out",
    inOut: "ease-in-out",
  },
} as const;

// ===== Z-Index Scale =====

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  banner: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  max: 100,
} as const;

// ===== Breakpoints =====

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// Export all tokens as a single object
export const tokens = {
  colors,
  rawColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  zIndex,
  breakpoints,
} as const;

export default tokens;
