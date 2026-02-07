/**
 * Tend UI - Tailwind Configuration
 * Uses Mission Control design system with tend-specific extensions.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // Tend-specific extensions
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Canvas Theme (tend-specific)
        canvas: {
          bg: 'var(--canvas-bg)',
          'bg-subtle': 'var(--canvas-bg-subtle)',
          'text-primary': 'var(--canvas-text-primary)',
          'text-muted': 'var(--canvas-text-muted)',
          accent: 'var(--canvas-accent)',
          'accent-light': 'var(--canvas-accent-light)',
        },
        // Block States (tend-specific)
        block: {
          draft: 'var(--block-draft)',
          'draft-border': 'var(--block-draft-border)',
          curated: 'var(--block-curated)',
          'curated-border': 'var(--block-curated-border)',
        },
        // Phase Badge Colors (earth-tones)
        moss: {
          DEFAULT: 'var(--color-moss)',
          foreground: 'var(--color-moss-foreground)',
        },
        clay: {
          DEFAULT: 'var(--color-clay)',
          foreground: 'var(--color-clay-foreground)',
        },
        brick: {
          DEFAULT: 'var(--color-brick)',
          foreground: 'var(--color-brick-foreground)',
        },
      },
    },
  },
  plugins: [],
};
