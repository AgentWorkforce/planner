import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 text-sm font-medium transition-all duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent text-text-secondary rounded-md data-[state=on]:bg-accent-cyan/15 data-[state=on]:text-accent-cyan",
        outline:
          "border border-border-subtle bg-transparent text-text-secondary hover:text-text-primary data-[state=on]:bg-accent-cyan/15 data-[state=on]:text-accent-cyan rounded-md",
        // For use inside ToggleGroup with outer border - no individual rounding
        grouped: "bg-transparent text-text-secondary data-[state=on]:bg-accent-cyan/15 data-[state=on]:text-accent-cyan",
        // Tabs variant: uses theme-aware bg-bg-card for active state (white in light, dark card in dark mode)
        tabs: "bg-transparent text-text-muted rounded-md data-[state=on]:bg-bg-card data-[state=on]:text-text-primary data-[state=on]:shadow-sm",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2.5 min-w-8",
        lg: "h-10 px-4 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
