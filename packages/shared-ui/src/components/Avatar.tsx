import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

const avatarVariants = cva(
  "relative inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium overflow-hidden",
  {
    variants: {
      size: {
        xs: "w-6 h-6 text-[10px]",
        sm: "w-8 h-8 text-xs",
        md: "w-10 h-10 text-sm",
        lg: "w-12 h-12 text-base",
        xl: "w-16 h-16 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  /** User/entity name (used for initials fallback) */
  name?: string;
  /** Image URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Status indicator */
  status?: "online" | "offline" | "busy" | "away";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Status colors using semantic CSS variables for theme compatibility.
 * Consuming apps should define these variables:
 * --color-status-online, --color-status-offline, --color-status-busy, --color-status-away
 * Falls back to Tailwind colors if variables are not defined.
 */
const statusColors = {
  online: "bg-[var(--color-status-online,#22c55e)]",
  offline: "bg-[var(--color-status-offline,#9ca3af)]",
  busy: "bg-[var(--color-status-busy,#ef4444)]",
  away: "bg-[var(--color-status-away,#eab308)]",
};

/**
 * Avatar component with image support, initials fallback, and status indicator.
 */
export function Avatar({
  name,
  src,
  alt,
  size,
  status,
  className,
  ...props
}: AvatarProps) {
  const initials = name ? getInitials(name) : "?";

  return (
    <div className={cn(avatarVariants({ size }), className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            statusColors[status],
            size === "xs" && "w-1.5 h-1.5",
            size === "sm" && "w-2 h-2",
            size === "md" && "w-2.5 h-2.5",
            size === "lg" && "w-3 h-3",
            size === "xl" && "w-4 h-4"
          )}
        />
      )}
    </div>
  );
}
