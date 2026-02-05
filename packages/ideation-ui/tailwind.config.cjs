/**
 * Ideation UI - Tailwind Configuration
 * Uses the shared Mission Control design system preset with app-specific canvas extensions.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  presets: [require('@plannr/shared-ui/theme/tailwind-preset')],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // Ideation-specific extensions
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
        // Canvas Theme (ideation-specific)
        canvas: {
          bg: 'var(--canvas-bg)',
          'bg-subtle': 'var(--canvas-bg-subtle)',
          'text-primary': 'var(--canvas-text-primary)',
          'text-muted': 'var(--canvas-text-muted)',
          accent: 'var(--canvas-accent)',
          'accent-light': 'var(--canvas-accent-light)',
        },
        // Block States (ideation-specific)
        block: {
          draft: 'var(--block-draft)',
          'draft-border': 'var(--block-draft-border)',
          curated: 'var(--block-curated)',
          'curated-border': 'var(--block-curated-border)',
        },
      },
    },
  },
  plugins: [],
};
