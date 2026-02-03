import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SessionWithDetails, useIdeationApi } from '@/hooks/useIdeationApi';
import { useConfidence } from '@/hooks/useConfidence';
import { ConfidenceBar } from './ConfidenceBar';
import { Button } from '@/components/ui';
import { SendIcon } from '@/components/icons';
import { useState } from 'react';

interface ChatHeaderProps {
  session: SessionWithDetails;
}

function truncateTitle(intent: string | undefined, maxLength = 40): string {
  if (!intent) return 'New Session';
  if (intent.length <= maxLength) return intent;
  return intent.slice(0, maxLength).trim() + '...';
}

function getButtonColor(score: number): string {
  if (score <= 40) return 'bg-error hover:bg-error/90';
  if (score <= 60) return 'bg-warning hover:bg-warning/90';
  return 'bg-success hover:bg-success/90';
}

export function ChatHeader({ session }: ChatHeaderProps) {
  const navigate = useNavigate();
  const { score, breakdown } = useConfidence(session.id);
  const api = useIdeationApi();
  const [isSending, setIsSending] = useState(false);

  const hasPreviousSends = session.planner_sends && session.planner_sends.length > 0;
  const buttonText = hasPreviousSends ? 'Update Plan' : 'Send to Planner';

  const handleSendToPlanner = async () => {
    setIsSending(true);
    try {
      const result = await api.sendToPlanner(session.id);
      if (result?.plan_id) {
        // Optionally navigate to the plan or show success
        navigate(`/session/${session.id}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <header className="h-14 px-4 flex items-center justify-between bg-bg-primary shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <h2 className="text-sm font-semibold text-text-primary truncate">
          {truncateTitle(session.source?.initial_intent ?? 'Untitled')}
        </h2>
        <ConfidenceBar score={score} breakdown={breakdown} />
      </div>
      <Button
        onClick={handleSendToPlanner}
        disabled={isSending}
        className={cn(
          'text-bg-deep font-medium text-xs',
          getButtonColor(score)
        )}
        size="sm"
      >
        <SendIcon size="sm" />
        {isSending ? 'Sending...' : buttonText}
      </Button>
    </header>
  );
}
