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

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Derive a short project name from the user's intent text.
 * Takes the first line, capped at 100 chars.
 */
function deriveName(text: string): string {
  const firstLine = (text.split('\n')[0] ?? text).trim();
  if (firstLine.length <= 100) return firstLine;
  return firstLine.slice(0, 97) + '...';
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

async function putJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
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
 * NewProjectModal
 *
 * Creates a project with an ideation session from the user's description.
 * The full text becomes the session's initial_intent; the first line
 * becomes the project name.
 */
export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const [intent, setIntent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!intent.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create project with short derived name
      const { project } = await postJson<{ project: { id: string } }>(
        '/api/projects',
        { name: deriveName(intent.trim()) },
      );

      // 2. Create ideation session with full intent
      const session = await postJson<{ id: string }>(
        '/api/ideation/sessions',
        { initial_intent: intent.trim() },
      );

      // 3. Link session to project
      await putJson('/api/projects/' + project.id, {
        session_id: session.id,
      });

      // 4. Close modal and navigate
      onOpenChange(false);
      setIntent('');
      navigate(`/projects/${project.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
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
          <DialogTitle>New Project</DialogTitle>
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
            {isSubmitting ? 'Creating...' : 'Start Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
