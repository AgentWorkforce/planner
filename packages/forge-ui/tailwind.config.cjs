/**
 * Forge UI - Tailwind Configuration
 * Uses the shared Mission Control design system preset.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  presets: [require('@plannr/shared-ui/theme/tailwind-preset')],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // App-specific extensions (if needed) go here
  theme: {
    extend: {},
  },
  plugins: [],
};
