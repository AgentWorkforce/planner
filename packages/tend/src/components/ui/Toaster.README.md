# Toast Notification System

A lightweight, React-based toast notification system for the ideation-ui package.

## Features

- **Simple API**: Easy-to-use `useToast()` hook
- **Multiple variants**: success, error, info, warning
- **Auto-dismiss**: Configurable duration (default 3 seconds)
- **Manual dismiss**: Click X to close any toast
- **Stacked display**: Multiple toasts stack vertically
- **Smooth animations**: Slide-in and fade-out transitions
- **Accessible**: Proper ARIA labels and roles

## Usage

### Basic Example

```tsx
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: "Success!",
      description: "Your changes have been saved",
      variant: "success"
    });
  };

  return <button onClick={handleSuccess}>Save</button>;
}
```

### API Reference

#### `useToast()`

Returns an object with:
- `toast(options)` - Show a new toast notification
- `dismiss(id)` - Manually dismiss a toast by ID
- `toasts` - Current array of visible toasts

#### Toast Options

```typescript
interface ToastOptions {
  title: string;              // Required: Main message
  description?: string;       // Optional: Additional details
  variant?: 'success' | 'error' | 'info' | 'warning'; // Default: 'info'
  duration?: number;          // Auto-dismiss time in ms (0 = no auto-dismiss)
}
```

### Variants

| Variant | Icon | Use Case |
|---------|------|----------|
| `success` | ✓ CheckCircle | Successful operations, confirmations |
| `error` | ⚠ AlertCircle | Errors, failures, critical issues |
| `info` | ℹ Info | General information, tips |
| `warning` | ⚠ AlertTriangle | Warnings, cautions, non-critical issues |

### Examples

#### Success Toast
```tsx
toast({
  title: "Block curated",
  description: "Successfully moved to curated ideas",
  variant: "success"
});
```

#### Error Toast
```tsx
toast({
  title: "Failed to save",
  description: "Network error. Please try again.",
  variant: "error"
});
```

#### Long-duration Toast
```tsx
toast({
  title: "Processing...",
  description: "This may take a few moments",
  variant: "info",
  duration: 5000  // 5 seconds
});
```

#### No Auto-dismiss
```tsx
toast({
  title: "Important Notice",
  description: "Please review before continuing",
  variant: "warning",
  duration: 0  // Must be manually dismissed
});
```

## Implementation Details

### Architecture

The toast system uses a singleton state pattern with React Context:
- **Global state**: Shared toast array across all hook instances
- **Event listeners**: Notify all subscribers when toasts change
- **Auto-cleanup**: Toasts automatically dismiss after their duration

### Positioning

Toasts appear in the **bottom-right corner** with:
- Fixed positioning (`fixed bottom-4 right-4`)
- High z-index (`z-[100]`)
- Stacked vertically with gap spacing

### Animations

- **Enter**: Slide in from right + fade in
- **Exit**: Fade out + slide right + scale down
- **Duration**: 200ms transitions

## Testing

See `Toaster.example.tsx` for interactive examples:
- All variant types
- Multiple simultaneous toasts
- Long messages
- Custom durations

## Integration

The `<Toaster />` component is already integrated in `App.tsx` at the root level. No additional setup required.

## Accessibility

- ✓ `role="alert"` for screen readers
- ✓ `aria-live="polite"` for non-intrusive announcements
- ✓ `aria-label` on dismiss buttons
- ✓ Keyboard accessible (focusable dismiss button)
- ✓ Sufficient color contrast for all variants

## Future Enhancements

Potential improvements:
- [ ] Action buttons in toasts
- [ ] Progress bar for duration visualization
- [ ] Positioning options (top-left, top-right, etc.)
- [ ] Sound effects
- [ ] Toast history/undo
