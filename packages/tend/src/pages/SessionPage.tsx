import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ConversationPane } from '@/components/conversation';
import { SessionTabBar, SessionUnderstandingTab } from '@/components/session';
import { useSession } from '@/hooks/useSession';
import { useUnderstanding } from '@/hooks/useUnderstanding';
import { LoadingSpinner } from '@/components/ui';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Detect active tab from URL
  const activeTab = location.pathname.endsWith('/understanding') ? 'understanding' : 'chat';

  // Call hooks at page level for loading/error states
  const { loading, error, refetch } = useSession(id);
  const { understanding, activeSpecialists, loading: understandingLoading } = useUnderstanding(id);

  // Tab change handler
  const handleTabChange = (tab: 'chat' | 'understanding') => {
    if (!id) return;
    if (tab === 'understanding') {
      navigate(`/session/${id}/understanding`);
    } else {
      navigate(`/session/${id}`);
    }
  };

  // Invalid ID state
  if (!id) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-text-primary text-lg mb-2">Invalid session</p>
        <p className="text-text-muted text-sm">No session ID provided.</p>
      </div>
    );
  }

  // Loading state - show before tabs render
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4">Opening conversation...</p>
      </div>
    );
  }

  // Error state - show with retry button
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-error mb-4">Lost connection to session</p>
        <p className="text-text-muted text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Component structure with tabs
  return (
    <div className="flex flex-col h-full">
      <SessionTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        understandingCount={Object.keys(understanding).length}
      />
      <div className={`flex-1 ${activeTab === 'understanding' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {activeTab === 'chat' ? (
          <ConversationPane sessionId={id} />
        ) : (
          <SessionUnderstandingTab
            understanding={understanding}
            activeSpecialists={activeSpecialists}
            loading={understandingLoading}
          />
        )}
      </div>
    </div>
  );
}
