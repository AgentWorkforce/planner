import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * ProjectPage — redirect wrapper for backward compatibility.
 *
 * Fetches the project to find its linked session_id, then redirects to
 * the session workspace at /s/:sessionId. If the project has no session,
 * falls back to showing an error.
 *
 * @route /projects/:id
 * @deprecated Use /s/:sessionId directly
 */
export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/projects/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`Project not found (HTTP ${res.status})`);
        return res.json();
      })
      .then((data: { project: { session_id: string | null } }) => {
        if (data.project.session_id) {
          // Redirect to session workspace
          navigate(`/s/${data.project.session_id}`, { replace: true });
        } else {
          setError('This project has no linked session. It may have been created before session-first navigation.');
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      });
  }, [id, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <div className="text-center space-y-2">
          <p className="text-error">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-text-muted hover:text-text-primary text-sm transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-bg-deep">
      <p className="text-text-secondary">Redirecting...</p>
    </div>
  );
}
