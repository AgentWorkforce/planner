# Shared UI Component Usage

## Status

As of Phase 2, Step 2.3:
- `@plannr/shared-ui` is now a dependency in all three UI packages (ideation-ui, planner-ui, forge-ui)
- **No local components were replaced** in this iteration (conservative approach)

## Why No Replacements?

After careful analysis, the local `ui/` components serve a **different purpose** than `@plannr/shared-ui`:

| Component Type | Purpose | Location |
|---------------|---------|----------|
| **Shadcn primitives** | Low-level UI building blocks (Dialog, Sheet, Sidebar, Select, Tooltip, Button) | Local `src/components/ui/` |
| **Semantic components** | Higher-level, domain-aware components (Badge, StatusIndicator, EntityCard, MessageBubble) | `@plannr/shared-ui` |

## Component Inventory

### Shared UI Components Available

From `@plannr/shared-ui`:
- **Core**: Pagination, ConfirmationDialog, Modal, Badge, Avatar, Tabs, Tooltip, SearchInput, EmptyState, LoadingSpinner, ThinkingIndicator, Dropdown, ErrorBoundary, TypingIndicator, CommandPalette
- **Status**: StatusIndicator, StatusDot
- **Lists**: ListItem, ListItemGroup, FeedItem
- **Notifications**: NotificationBanner
- **Cards**: EntityCard
- **Forms**: Autocomplete
- **Panels**: DetailPanel, DetailPanelSection, DetailPanelDivider
- **Status Bar**: StatusBar
- **Messaging**: DateSeparator, MessageBubble, MessageList, MessageInput

### Planner UI Local Components

Shadcn-generated components in `packages/planner-ui/src/components/ui/`:
- **Badge.tsx** - Plan-specific variants (draft, approved, published, submitted) - **keep local**
- **Button.tsx** - Mission Control themed variants - **keep local**
- **TabPill.tsx** - Custom tab styling - **keep local**
- **input.tsx**, **separator.tsx**, **sheet.tsx**, **skeleton.tsx**, **table.tsx**, **sidebar.tsx**, **select.tsx**, **toggle-group.tsx**, **toggle.tsx**, **tooltip.tsx** - All shadcn primitives with project-specific customization - **keep local**

### Forge UI Local Components

Shadcn-generated components in `packages/forge-ui/src/components/ui/`:
- **Button.tsx** - Mission Control themed variants - **keep local**
- **dialog.tsx**, **input.tsx**, **separator.tsx**, **sheet.tsx**, **sidebar.tsx**, **skeleton.tsx**, **tooltip.tsx** - All shadcn primitives - **keep local**

## When to Use What

### Use `@plannr/shared-ui` when:
- Building higher-level domain components
- Need consistent semantic variants across apps (success, warning, error states)
- Building messaging/collaboration UI
- Need pre-built hooks (useCommandPalette, etc.)

### Use local `ui/` components when:
- Building low-level UI primitives
- Need app-specific customization (planner-ui Badge with plan statuses)
- Using Radix UI components with project-specific styling

## Future Opportunities

### Candidates for Extraction to Shared UI

If we see these patterns duplicated across apps:
1. **Mission Control Button variants** - Currently duplicated in planner-ui and forge-ui
2. **Skeleton patterns** - Similar loading states across apps
3. **Modal/Dialog patterns** - If we standardize on specific dialog layouts

### Not Candidates for Shared UI

Keep local:
- **Sidebar** - App-specific navigation structure
- **Select** - Often needs app-specific option rendering
- **Sheet** - Usage patterns vary by app
- **Toggle/ToggleGroup** - Usually app-specific semantics

## Analysis Notes

### Badge Component Comparison

**planner-ui Badge** (keep local):
```typescript
// Plan-specific status variants
type BadgeVariant = 'draft' | 'approved' | 'published' | 'submitted' | ...
```

**shared-ui Badge** (generic):
```typescript
// Generic semantic variants
variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
```

These serve different purposes and should coexist.

### Tooltip Component Comparison

**planner-ui tooltip** (Radix UI based):
- Full Radix UI implementation
- Portal rendering
- Advanced positioning
- Animation support

**shared-ui Tooltip** (simple):
- Pure CSS positioning
- Simpler API
- Lighter weight

The Radix version is more powerful for complex UIs, while shared-ui's is fine for simple cases.

## Import Examples

```typescript
// Importing from shared-ui
import { EmptyState, LoadingSpinner, CommandPalette } from '@plannr/shared-ui';
import { StatusIndicator } from '@plannr/shared-ui';

// Importing local shadcn components
import { Button } from '@/components/ui/Button';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/Badge'; // planner-ui specific variants
```

## Next Steps

In future phases, consider:
1. Extract Mission Control Button variants to shared-ui if all apps adopt them
2. Create app-specific variant extensions mechanism (e.g., shared-ui Badge base + planner-ui status extension)
3. Audit for other cross-app patterns worth extracting
