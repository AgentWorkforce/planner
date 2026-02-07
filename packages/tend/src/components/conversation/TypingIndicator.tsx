import { BrainIcon } from '@/components/icons';

export function TypingIndicator() {
  return (
    <div className="flex gap-2 mb-4">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
        <BrainIcon size="sm" className="text-accent-purple" />
      </div>

      {/* Bubble with animated dots */}
      <div className="bg-bg-tertiary rounded-lg px-4 py-3 flex items-center gap-1">
        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot" />
        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot-delay-1" />
        <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot-delay-2" />
      </div>
    </div>
  );
}
