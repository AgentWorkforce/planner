import { createContext, useContext, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

const cardVariants = cva(
  "relative rounded-lg border transition-all",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        outline: "bg-transparent border-border",
        elevated: "bg-card border-border shadow-md",
      },
      size: {
        sm: "p-3",
        md: "p-4",
        lg: "p-5",
      },
      clickable: {
        true: "cursor-pointer hover:border-border/80 hover:shadow-sm",
        false: "",
      },
      selected: {
        true: "ring-2 ring-primary ring-offset-2 ring-offset-background",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      clickable: false,
      selected: false,
    },
  }
);

type AccentStyle = "border" | "tint" | "glow";

interface EntityCardContextValue {
  size: "sm" | "md" | "lg";
}

const EntityCardContext = createContext<EntityCardContextValue>({ size: "md" });

export interface EntityCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Accent color (any CSS color) */
  accentColor?: string;
  /** How to apply accent color */
  accentStyle?: AccentStyle;
  /** Click handler (makes card clickable) */
  onClick?: () => void;
}

/**
 * Generic entity card with composable sub-components.
 */
const EntityCardBase = forwardRef<HTMLDivElement, EntityCardProps>(
  (
    {
      variant,
      size = "md",
      clickable,
      selected,
      accentColor,
      accentStyle = "border",
      onClick,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isClickable = clickable || !!onClick;

    const handleClick = () => onClick?.();

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && isClickable) {
        e.preventDefault();
        onClick?.();
      }
    };

    const accentStyles: React.CSSProperties = {};
    if (accentColor) {
      if (accentStyle === "border") {
        accentStyles.borderLeftColor = accentColor;
        accentStyles.borderLeftWidth = "3px";
      } else if (accentStyle === "tint") {
        accentStyles.backgroundColor = `color-mix(in srgb, ${accentColor} 5%, transparent)`;
      } else if (accentStyle === "glow") {
        accentStyles.boxShadow = `0 0 0 1px ${accentColor}20, 0 0 20px ${accentColor}10`;
      }
    }

    return (
      <EntityCardContext.Provider value={{ size: size || "md" }}>
        <div
          ref={ref}
          className={cn(
            cardVariants({ variant, size, clickable: isClickable, selected }),
            className
          )}
          style={{ ...accentStyles, ...style }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={isClickable ? 0 : undefined}
          role={isClickable ? "button" : undefined}
          {...props}
        >
          {children}
        </div>
      </EntityCardContext.Provider>
    );
  }
);

EntityCardBase.displayName = "EntityCard";

// Sub-components
interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: "sm" | "md" | "lg";
}

const Header = forwardRef<HTMLDivElement, HeaderProps>(
  ({ gap = "md", className, children, ...props }, ref) => {
    const gapClass = { sm: "gap-2", md: "gap-3", lg: "gap-4" }[gap];
    return (
      <div
        ref={ref}
        className={cn("flex items-start", gapClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Header.displayName = "EntityCard.Header";

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  bgColor?: string;
}

const Icon = forwardRef<HTMLDivElement, IconProps>(
  ({ bgColor, className, style, children, ...props }, ref) => {
    const { size } = useContext(EntityCardContext);
    const sizeClass = {
      sm: "w-8 h-8 text-sm",
      md: "w-10 h-10 text-base",
      lg: "w-12 h-12 text-lg",
    }[size];

    return (
      <div
        ref={ref}
        className={cn(
          "flex-shrink-0 rounded-lg flex items-center justify-center",
          sizeClass,
          !bgColor && "bg-muted",
          className
        )}
        style={bgColor ? { backgroundColor: bgColor, ...style } : style}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Icon.displayName = "EntityCard.Icon";

const TitleArea = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 min-w-0", className)} {...props}>
      {children}
    </div>
  )
);
TitleArea.displayName = "EntityCard.TitleArea";

const Title = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    const { size } = useContext(EntityCardContext);
    const textClass = { sm: "text-sm", md: "text-base", lg: "text-lg" }[size];
    return (
      <h3
        ref={ref}
        className={cn("font-semibold text-foreground truncate", textClass, className)}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
Title.displayName = "EntityCard.Title";

const Subtitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground truncate", className)}
      {...props}
    >
      {children}
    </p>
  )
);
Subtitle.displayName = "EntityCard.Subtitle";

const BadgeArea = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex-shrink-0", className)} {...props}>
      {children}
    </div>
  )
);
BadgeArea.displayName = "EntityCard.Badge";

interface BodyProps extends React.HTMLAttributes<HTMLDivElement> {
  minHeight?: number;
}

const Body = forwardRef<HTMLDivElement, BodyProps>(
  ({ minHeight, className, style, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-3", className)}
      style={minHeight ? { minHeight, ...style } : style}
      {...props}
    >
      {children}
    </div>
  )
);
Body.displayName = "EntityCard.Body";

interface DescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  lines?: number;
}

const Description = forwardRef<HTMLParagraphElement, DescriptionProps>(
  ({ lines = 2, className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-sm text-muted-foreground",
        lines === 1 && "truncate",
        lines === 2 && "line-clamp-2",
        lines === 3 && "line-clamp-3",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
);
Description.displayName = "EntityCard.Description";

const EmptyDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground/50 italic", className)}
      {...props}
    >
      {children || "No description"}
    </p>
  )
);
EmptyDescription.displayName = "EntityCard.EmptyDescription";

interface FooterProps extends React.HTMLAttributes<HTMLDivElement> {
  border?: boolean;
}

const Footer = forwardRef<HTMLDivElement, FooterProps>(
  ({ border = true, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mt-3 pt-3 flex items-center justify-between",
        border && "border-t border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Footer.displayName = "EntityCard.Footer";

const Stats = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-4", className)} {...props}>
      {children}
    </div>
  )
);
Stats.displayName = "EntityCard.Stats";

interface StatItemProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  color?: string;
}

const StatItem = forwardRef<HTMLDivElement, StatItemProps>(
  ({ label, value, color, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-1.5", className)} {...props}>
      {color && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  )
);
StatItem.displayName = "EntityCard.StatItem";

const Separator = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("text-muted-foreground/30", className)}
      {...props}
    >
      ·
    </span>
  )
);
Separator.displayName = "EntityCard.Separator";

interface IndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  pulse?: boolean;
}

const Indicator = forwardRef<HTMLSpanElement, IndicatorProps>(
  ({ color = "currentColor", pulse, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        pulse && "animate-pulse",
        className
      )}
      style={{ backgroundColor: color }}
      {...props}
    />
  )
);
Indicator.displayName = "EntityCard.Indicator";

// Attach sub-components
const EntityCardCompound = Object.assign(EntityCardBase, {
  Header,
  Icon,
  TitleArea,
  Title,
  Subtitle,
  Badge: BadgeArea,
  Body,
  Description,
  EmptyDescription,
  Footer,
  Stats,
  StatItem,
  Separator,
  Indicator,
});

export { EntityCardCompound as EntityCard };
export type { HeaderProps, IconProps, BodyProps, DescriptionProps, FooterProps, StatItemProps, IndicatorProps };
