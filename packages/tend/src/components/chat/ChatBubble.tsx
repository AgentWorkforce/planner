import { cn } from '@/lib/utils';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { BrainIcon } from '@/components/icons';
import { MultipleChoiceInput } from '../conversation/MultipleChoiceInput';

interface ChatBubbleProps {
  message: TranscriptMessage;
  onSelectOption?: (optionId: string) => void;
  isLatestUnanswered?: boolean;
  attentionLevel?: 0 | 1 | 2 | 3;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const ATTENTION_STYLES: Record<number, string> = {
  0: 'opacity-60',  // L0: background, muted
  1: '',            // L1: normal, no extra styling
  2: 'border-l-2 border-accent-primary bg-accent-primary/5',  // L2: highlighted
  3: 'border-l-2 border-accent-secondary bg-accent-secondary/5 animate-pulse',  // L3: urgent
};

export function ChatBubble({ message, onSelectOption, isLatestUnanswered = false, attentionLevel }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const hasMultipleChoice = !isUser && message.multiple_choice && message.multiple_choice.options.length > 0;
  const isAnswered = message.multiple_choice?.selected_id !== undefined;

  return (
    <div
      className={cn(
        'flex gap-2 mb-4',
        isUser ? 'flex-row-reverse' : 'flex-row',
        attentionLevel != null && ATTENTION_STYLES[attentionLevel]
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
          <BrainIcon size="sm" className="text-accent-purple" />
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-[70%]">
        {/* Bubble */}
        <div
          className={cn(
            'rounded-lg px-4 py-2',
            isUser
              ? 'bg-accent-cyan/20 text-text-primary'
              : 'text-text-primary'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <span
            className={cn(
              'text-xs mt-1 block',
              isUser ? 'text-accent-cyan/60 text-right' : 'text-text-muted'
            )}
          >
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Multiple Choice Options - only show for assistant messages with options */}
        {hasMultipleChoice && message.multiple_choice && (
          <MultipleChoiceInput
            options={message.multiple_choice.options}
            onSelect={(optionId) => {
              if (onSelectOption && isLatestUnanswered) {
                onSelectOption(optionId);
              }
            }}
            disabled={!isLatestUnanswered || isAnswered}
            selectedId={message.multiple_choice.selected_id}
          />
        )}
      </div>
    </div>
  );
}
