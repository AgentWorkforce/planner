import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { BrainIcon } from '@/components/icons';
import { MultipleChoiceInput } from './MultipleChoiceInput';

interface MessageBubbleProps {
  message: TranscriptMessage;
  onOptionSelect?: (value: string) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, onOptionSelect }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const hasOptions = message.metadata?.options && message.metadata.options.length > 0;

  const handleOptionSelect = (value: string) => {
    setSelectedOption(value);
    onOptionSelect?.(value);
  };

  return (
    <div
      className={cn(
        'flex gap-2 mb-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
          <BrainIcon size="sm" className="text-accent-purple" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2',
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

        {/* Multiple Choice Input */}
        {!isUser && hasOptions && message.metadata?.options && (
          <MultipleChoiceInput
            options={message.metadata.options}
            onSelect={handleOptionSelect}
            selected={selectedOption}
            disabled={!!selectedOption}
          />
        )}
      </div>
    </div>
  );
}
