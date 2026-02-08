# @plannr/shared-ui

Shared design system and component library for the Plannr monorepo.

## Installation

```bash
# From monorepo root
npm install

# Build the package
cd packages/shared-ui
npm run build
```

## Usage

### Components

```tsx
import {
  Badge,
  Button,
  Modal,
  Pagination,
  SearchInput,
  StatusIndicator,
  LoadingSpinner,
  EmptyState,
  CommandPalette,
} from '@plannr/shared-ui';

import { MessageBubble, MessageList, MessageInput } from '@plannr/shared-ui';
```

### Icons

```tsx
import { ChevronLeftIcon, SearchIcon, CloseIcon } from '@plannr/shared-ui/icons';

<ChevronLeftIcon size={20} className="text-accent-cyan" />
```

### Hooks

```tsx
import { useDebounce } from '@plannr/shared-ui/hooks';

const debouncedValue = useDebounce(searchTerm, 300);
```

### Theme System

#### Tailwind Preset

```js
// tailwind.config.cjs
module.exports = {
  presets: [require('@plannr/shared-ui/theme/tailwind-preset')],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@plannr/shared-ui/dist/**/*.js',
  ],
};
```

#### CSS Tokens

```tsx
// Import in your app entry point
import '@plannr/shared-ui/styles/tokens.css';
import '@plannr/shared-ui/styles/base.css';
import '@plannr/shared-ui/styles/typography.css';
```

Or use the combined import:

```tsx
import '@plannr/shared-ui/styles';
```

### Theme Provider

```tsx
import { ThemeProvider } from '@plannr/shared-ui';

<ThemeProvider defaultTheme="dark">
  <App />
</ThemeProvider>
```

## Exports

### Components (`@plannr/shared-ui`)
- **Core**: Badge, Modal, Tabs, Tooltip, Dropdown, Pagination, SearchInput
- **Status**: StatusIndicator, LoadingSpinner, ThinkingIndicator, TypingIndicator
- **Layout**: EntityCard, DetailPanel, ListItem, NotificationBanner, StatusBar
- **Messaging**: MessageBubble, MessageList, MessageInput, DateSeparator
- **Utility**: EmptyState, ErrorBoundary, ConfirmationDialog, Autocomplete, CommandPalette

### Icons (`@plannr/shared-ui/icons`)
- Navigation: Chevron, Arrow, Menu, Close
- Actions: Search, Plus, Edit, Delete, Copy, Check
- Status: Alert, Info, Warning, Error, Success
- Other: File, User, Settings, Calendar, etc.

All icons accept `size` and `className` props, use `currentColor` for themability.

### Hooks (`@plannr/shared-ui/hooks`)
- `useDebounce` - Debounce state updates

### Theme (`@plannr/shared-ui/theme`)
- Design tokens (TypeScript constants)
- Tailwind preset (CommonJS config)

### Styles
- `@plannr/shared-ui/styles` - Combined CSS import
- `@plannr/shared-ui/styles/tokens.css` - CSS variables (colors, shadows, spacing)
- `@plannr/shared-ui/styles/base.css` - Reset and base styles
- `@plannr/shared-ui/styles/typography.css` - Font definitions and text styles

## Design Tokens

Mission Control aesthetic with:
- Dark theme default (shadcn-compatible variables)
- Nested color scales: `bg.deep`, `text.primary`, `accent.cyan`
- Status colors: success, warning, error, info (with light variants)
- Neon accents: cyan, orange, purple, green
- Glow shadows for interactive elements

## Scripts

```bash
npm run build       # Compile TypeScript
npm run dev         # Watch mode for development
npm run typecheck   # Type validation
npm run test        # Run tests with Vitest
npm run test:watch  # Test watch mode
```

## Adding New Components

1. Create component in `src/components/YourComponent.tsx`
2. Export from `src/components/index.ts`
3. Run `npm run build` to compile
4. Import in consuming apps with `import { YourComponent } from '@plannr/shared-ui'`
