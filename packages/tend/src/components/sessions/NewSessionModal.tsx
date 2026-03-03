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

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * NewConversationModal
 *
 * Creates a new ideation session from the user's initial intent and
 * navigates directly to that session workspace.
 */
export function NewConversationModal({ open, onOpenChange }: NewConversationModalProps) {
  const [intent, setIntent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!intent.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const session = await postJson<{ id: string }>(
        '/api/ideation/sessions',
        { initial_intent: intent.trim() },
      );

      onOpenChange(false);
      setIntent('');
      navigate(`/s/${session.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(message);
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
          <DialogTitle>New Conversation</DialogTitle>
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
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
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
            {isSubmitting ? 'Starting...' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Backward-compat alias for any remaining references to NewProjectModal
export { NewConversationModal as NewProjectModal };
