import { cn } from "../utils/cn";
import { Avatar } from "./Avatar";

export interface TypingUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface TypingIndicatorProps {
  /** Users currently typing */
  typingUsers: TypingUser[];
  /** Maximum avatars to show before "+N more" */
  maxAvatars?: number;
  /** Size of avatars */
  avatarSize?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Animated typing indicator showing who is currently typing.
 * Displays user avatars with animated dots.
 */
export function TypingIndicator({
  typingUsers,
  maxAvatars = 3,
  avatarSize = "sm",
  className,
}: TypingIndicatorProps) {
  if (typingUsers.length === 0) {
    return null;
  }

  const visibleUsers = typingUsers.slice(0, maxAvatars);
  const remainingCount = typingUsers.length - maxAvatars;

  const formatTypingText = (): string => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]?.name} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]?.name} and ${typingUsers[1]?.name} are typing`;
    }
    if (typingUsers.length === 3) {
      return `${typingUsers[0]?.name}, ${typingUsers[1]?.name}, and ${typingUsers[2]?.name} are typing`;
    }
    return `${typingUsers[0]?.name} and ${typingUsers.length - 1} others are typing`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      {/* Avatars */}
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <Avatar
            key={user.id}
            name={user.name}
            src={user.avatarUrl}
            size={avatarSize}
            className="ring-2 ring-background"
          />
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background",
              avatarSize === "sm" ? "w-6 h-6" : "w-8 h-8"
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Typing text with animation */}
      <div className="flex items-center gap-1">
        <span>{formatTypingText()}</span>
        <TypingDots />
      </div>
    </div>
  );
}

/**
 * Animated typing dots for inline use.
 */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "800ms" }}
        />
      ))}
    </span>
  );
}
