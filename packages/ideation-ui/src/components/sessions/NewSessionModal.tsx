import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Textarea,
} from '@/components/ui';
import { useIdeationApi } from '@/hooks/useIdeationApi';

interface NewSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSessionModal({ open, onOpenChange }: NewSessionModalProps) {
  const [intent, setIntent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const api = useIdeationApi();

  const handleSubmit = async () => {
    if (!intent.trim()) return;

    setIsSubmitting(true);
    try {
      const session = await api.createSession(intent.trim());
      if (session) {
        onOpenChange(false);
        setIntent('');
        navigate(`/ideation/session/${session.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Brainstorming Session</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to build or explore?"
            className="min-h-[120px] resize-none"
            autoFocus
          />
          <p className="text-xs text-text-muted mt-2">
            Press Cmd+Enter to submit
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!intent.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Start Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
