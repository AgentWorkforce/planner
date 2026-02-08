/**
 * Mission Control Design System - Tailwind Preset
 *
 * A Tailwind CSS preset that provides the Mission Control theme.
 * Apps can extend this to get consistent styling.
 *
 * Usage in tailwind.config.cjs:
 * module.exports = {
 *   presets: [require('@plannr/shared-ui/theme/tailwind-preset.cjs')],
 *   // ... your config
 * }
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ===== Shadcn/ui Compatible Colors =====
        // These work with standard shadcn components
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          // Mission Control neon accents
          cyan: 'var(--color-accent-cyan)',
          orange: 'var(--color-accent-orange)',
          purple: 'var(--color-accent-purple)',
          green: 'var(--color-accent-green)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        // Border system (shadcn + Mission Control extended)
        border: {
          DEFAULT: 'var(--border)', // shadcn compatible
          subtle: 'var(--color-border-subtle)',
          light: 'var(--color-border-light)',
          medium: 'var(--color-border-medium)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',

        // ===== Mission Control Extended Palette =====
        // Background depth system
        bg: {
          deep: 'var(--color-bg-deep)',
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          card: 'var(--color-bg-card)',
          elevated: 'var(--color-bg-elevated)',
          hover: 'var(--color-bg-hover)',
          active: 'var(--color-bg-active)',
        },
        // Text hierarchy
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          dim: 'var(--color-text-dim)',
          inverse: 'var(--color-text-inverse)',
        },
        // Status Colors
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          light: 'var(--color-error-light)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)',
        },
        // Sidebar
        sidebar: {
          DEFAULT: 'var(--color-sidebar-bg)',
          bg: 'var(--color-sidebar-bg)',
          border: 'var(--color-sidebar-border)',
          hover: 'var(--color-sidebar-hover)',
          foreground: 'var(--color-text-primary)',
          primary: 'var(--color-accent-cyan)',
          'primary-foreground': 'var(--color-text-inverse)',
          accent: 'var(--color-bg-hover)',
          'accent-foreground': 'var(--color-text-primary)',
          ring: 'var(--color-accent-cyan)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '14px',
        lg: '15px',
        xl: '16px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      spacing: {
        sidebar: '280px',
        header: '52px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        modal: 'var(--shadow-modal)',
        'glow-cyan': 'var(--shadow-glow-cyan)',
        'glow-orange': 'var(--shadow-glow-orange)',
        'glow-purple': 'var(--shadow-glow-purple)',
        'glow-green': 'var(--shadow-glow-green)',
      },
      animation: {
        spin: 'spin 1s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 150ms ease',
        'slide-up': 'slideUp 200ms ease',
        'slide-down': 'slideDown 200ms ease',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(0, 217, 255, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 20px 4px transparent' },
        },
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
    },
  },
};
