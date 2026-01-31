# Frontend Patterns

## Tailwind CSS v4

- **Configuration format**: Use CommonJS (`tailwind.config.cjs`), not ESM. The `@config` directive in CSS requires CJS exports.
- **CSS variables**: Define color schemes in `globals.css` using CSS variables (`--color-...`) in `:root` and theme classes (`.theme-dark`, `.theme-light`).
- **Nested color scales**: In `tailwind.config.js`, use `theme.extend` with nested scales (`bg.deep`, `text.primary`) that reference CSS variables via `var(--color-...)`.
- **@config directive**: Must be present in `globals.css` for Tailwind to load configuration and generate utility classes.

## Component Architecture

- **Reusable components**: Extract common patterns into components (e.g., `PlanCard`, `CollapsibleSection`, `AttentionBadge`, `EditableText`, `DependencyIndicator`).
- **Icon components**: Implement as SVG in `src/components/icons/`, accepting `size` and `className` props, using `currentColor` for fill/stroke.
- **Inline editing**: Prefer inline editing over modals for simple text fields.
- **Error/loading states**: Always provide user feedback for loading states, errors, and empty states.

## State Management

- **Custom hooks**: Encapsulate reusable logic in hooks (e.g., `useAttentionPlans`, `usePlansViewMode`, `useFuzzySearch`, `useCommandPalette`, `useRecentPlans`).
- **Local storage persistence**: Use `localStorage` for user preferences (sidebar state, view mode).
- **Debouncing**: Use debouncing for API calls triggered by frequent UI updates (filtering, search).
- **useRef for stability**: Use `useRef` in hooks to prevent stale closures, especially in channel message handlers.

## Design System

- **Reference**: Match `relay-dashboard` look and feel—colors, padding, component patterns.
- **Dark theme default**: System defaults to dark mode ("Mission Control aesthetic") but respects OS preference.
- **Visual hierarchy**: Maintain clear differentiation between sections with consistent spacing.
- **Action-oriented layout**: Prioritize surfacing items requiring attention ("Needs Attention" section) over pure categorical organization.
- **Command palette**: Use Cmd+K/Ctrl+K for keyboard-first navigation at scale.
- **Focus states**: Implement `:focus-visible` for keyboard navigation accessibility.

## Vite Configuration

- **WebSocket proxy**: Explicitly configure WebSocket upgrades (`ws://`) in `vite.config.ts` proxy settings. HTTP-only proxy config breaks real-time connections.
- **Aliases**: Use `@` path alias for cleaner imports.

## Common Mistakes

- **Inconsistent class names**: Ensure Tailwind config (nested colors) matches component class usage.
- **Double borders**: Avoid applying borders at multiple hierarchy levels.
- **Race conditions**: Use `useEffect` with `requestAnimationFrame` when depending on DOM positions after dynamic content changes.
