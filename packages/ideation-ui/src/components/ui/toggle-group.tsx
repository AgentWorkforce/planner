"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps, cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

const toggleGroupVariants = cva(
  "inline-flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "gap-1",
        outline: "rounded-lg border border-border-subtle bg-transparent divide-x divide-border-subtle overflow-hidden",
        // Tabs variant: subtle border container, pill-style selection inside
        tabs: "gap-0.5 p-0.5 rounded-lg border border-border-subtle bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => {
  // Map toggle variant to group container variant
  const groupVariant = variant === "outline" ? "outline" : variant === "tabs" ? "tabs" : "default"

  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn(
        toggleGroupVariants({ variant: groupVariant }),
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
})

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  // Map parent variant to item variant
  // - 'outline' parent → 'grouped' items (no individual rounding)
  // - 'tabs' parent → 'tabs' items (white bg on active in light mode)
  const effectiveVariant =
    context.variant === "outline" ? "grouped" :
    context.variant === "tabs" ? "tabs" :
    (context.variant || variant)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: effectiveVariant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
