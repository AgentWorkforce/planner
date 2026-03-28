# Frontend Patterns

## Tailwind CSS v4

- **Configuration format**: Use CommonJS (`tailwind.config.cjs`), not ESM. The `@config` directive in CSS requires CJS exports.
- **Theme preset**: Each app's `tailwind.config.cjs` extends `@plannr/shared-ui/theme/tailwind-preset.cjs`
- **CSS variables**: Define color schemes in each app's `globals.css` using `--color-...` in `:root` and theme classes (`.theme-dark`, `.theme-light`)
- **Nested color scales**: In `tailwind.config.cjs`, use `theme.extend` with nested scales (`bg.deep`, `text.primary`) that reference CSS variables via `var(--color-...)`
- **@config directive**: Must be present in `globals.css` for Tailwind to load configuration
- **Dark mode**: `class` selector + `prefers-color-scheme` media query

### Arbitrary Value Syntax

Always wrap CSS variables with `var()`:

```css
/* CORRECT - Tailwind v4 */
w-[var(--sidebar-width)]

/* WRONG - will not work in v4 */
w-[--sidebar-width]
```

## Shared Design System (`@plannr/shared-ui`)

- `src/theme/tailwind-preset.cjs` - Mission Control theme preset
- `src/styles/tokens.css` - CSS variable token exports
- `src/components/` - CommandPalette, Autocomplete, Avatar, EntityCard, ErrorBoundary, Modal, SearchInput, StatusIndicator, ThinkingIndicator
- `src/icons/` - Shared icon components
- `src/hooks/` - Shared hooks (79 hooks total across packages)
- `src/providers/` - Shared context providers
- **Fonts**: Outfit (display), Inter (sans), IBM Plex Mono (mono)

## Shadcn/ui + Radix UI

Use `cva` (class-variance-authority) for extending shadcn components:

```tsx
const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center...", // base styles
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

- Use `cn()` to combine variants with additional styling
- Reference theme variables (`bg-background`, `text-foreground`)
- Check existing variants before creating new ones
- Map shadcn expectations to project variables in `globals.css`:

```css
:root {
  --sidebar-background: var(--color-sidebar-bg);
  --sidebar-foreground: var(--color-sidebar-text);
}
```

## Component Architecture

### Planner-UI Components
- PlanCard, CollapsibleSection, AttentionBadge, EditableText, DependencyIndicator

### Ideation-UI Components
- PhysicsBlockBase (shared base for physics animations)
- SessionPhysicsBlock, SessionsPhysicsColumn

### Shared Components
- CommandPalette, EntityCard, Autocomplete, Avatar (in `@plannr/shared-ui`)

### Icon Components
- `lucide-react` + custom SVGs in `packages/*/src/components/icons/`
- Accept `size` and `className` props
- Use `currentColor` for fill/stroke

### General Patterns
- **Inline editing** over modals for simple text fields
- **Always provide** error/loading/empty states

## State Management (Hooks)

### Key Planner-UI Hooks
- useAttentionPlans, usePlansViewMode, useFuzzySearch, useCommandPalette
- useRecentPlans, usePlanEvents, useRelayConnection, usePresence, usePipelinePlans

### Key Ideation-UI Hooks
- usePhysicsEngine (Matter.js), usePanelState, useUnderstanding, useSessions

### Patterns
- **Custom hooks** encapsulate domain logic
- **`localStorage`** for user preferences (sidebar state, view mode)
- **Debouncing** for frequent UI updates (filtering, search)
- **`useRef`** for stability in message handlers (prevent stale closures)

## Ideation-Specific Theming

- **Canvas theme**: Warm cream sand light (#f2f1ed) / mission control dark (#1a1a1a)
- **Block states**: `--block-draft`, `--block-curated` with borders
- **Session progress colors**: new/developing/maturing/ready states
- **Physics animations**: `physics-block-pop-in` (scale), `synonym-swap`, `session-slide-out`, `bounce-dot`, `glow-pulse`
- **GPU acceleration**: `will-change: transform`, transform-only animations, `requestAnimationFrame` for physics sync

## Design System

- **"Mission Control aesthetic"** - dark theme default, respects OS preference
- **Visual hierarchy** with clear section differentiation
- **Action-oriented layout** - prioritize "Needs Attention" sections
- **Cmd+K/Ctrl+K** command palette for keyboard navigation
- **`:focus-visible`** for keyboard accessibility

## Vite Configuration

- **WebSocket proxy**: Explicitly configure `ws://` upgrades - HTTP-only breaks real-time connections
- **SSE buffering disabled** for event streams
- **Different ports** per app (3000, 3002, 3003) all proxy `/api` → localhost:3001
- **`@` path alias** for imports

## CSS Stacking & z-index

- `z-index` alone won't work without parent positioning (`position: relative/absolute/fixed`)
- Use React portals for overlays escaping parent stacking contexts
- Set explicit `position` on parent elements when children need `z-index` control

## Common Mistakes

- **Inconsistent Tailwind class names** vs config (nested colors)
- **Double borders** at multiple hierarchy levels
- **Race conditions** with DOM positions - use `requestAnimationFrame`
- **z-index without positioning** - won't work if parent stacking context is broken
- **Per-component WebSocket connections** instead of shared Context (see react-patterns.md)
