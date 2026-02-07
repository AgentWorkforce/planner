/**
 * GraduationDialog - Confirms project graduation to plan or forge
 *
 * Displays what will happen and allows user to confirm/cancel.
 */

import { useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';

interface GraduationDialogProps {
  target: 'plan' | 'forge';
  onClose: () => void;
  onSuccess?: (result: { project: any; plan_id?: string; run_id?: string }) => void;
}

export function GraduationDialog({ target, onClose, onSuccess }: GraduationDialogProps) {
  const { project } = useProject();
  const [isGraduating, setIsGraduating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!project) {
    return null;
  }

  const handleGraduate = async () => {
    setIsGraduating(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/graduate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to graduate: ${res.statusText}`);
      }

      const result = await res.json();
      setSuccess(true);

      // Show success state briefly before closing
      setTimeout(() => {
        onSuccess?.(result);
        onClose();
      }, 1000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsGraduating(false);
    }
  };

  const title = target === 'plan' ? 'Graduate to Plan' : 'Graduate to Forge';
  const description =
    target === 'plan'
      ? 'This will create a new plan from your ideation session. You can then add steps and structure your work.'
      : 'This will create a forge run from your plan and begin execution.';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full p-6">
        {success ? (
          <div className="text-center">
            <div className="text-2xl mb-2">✓</div>
            <h2 className="text-lg font-semibold text-foreground">Success!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Graduation complete. Redirecting...
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{description}</p>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mb-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isGraduating}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGraduate}
                disabled={isGraduating}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {isGraduating ? 'Graduating...' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
