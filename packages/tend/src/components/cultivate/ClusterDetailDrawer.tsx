import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Skeleton,
} from '@/components/ui';
import { useCultivateCluster } from '@/hooks/useCultivateCluster';
import { EvidencePanel } from './EvidencePanel';
import { QuestionsPanel } from './QuestionsPanel';
import { IntentBadge } from './IntentBadge';
import { PrdDialog } from './PrdDialog';
import { SegmentBadge } from './SegmentBadge';
import { QualityBar } from './QualityBar';
import { DemandIndicator } from './DemandIndicator';
import { SentimentBar } from './SentimentBar';
import { cn } from '@/lib/utils';

interface ClusterDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string | null;
  greenhouseId?: string;
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

const TREND_STYLES: Record<string, { label: string; className: string }> = {
  rising: { label: 'Rising', className: 'text-emerald-400' },
  stable: { label: 'Stable', className: 'text-text-muted' },
  declining: { label: 'Declining', className: 'text-amber-400' },
};

export function ClusterDetailDrawer({
  open,
  onOpenChange,
  clusterId,
  greenhouseId: greenhouseIdProp,
}: ClusterDetailDrawerProps) {
  const navigate = useNavigate();
  const { cluster, loading, error } = useCultivateCluster(open ? clusterId : null);
  const [prdOpen, setPrdOpen] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Clear action error when drawer opens/closes
  const handleOpenChange = (next: boolean) => {
    setActionError(null);
    onOpenChange(next);
  };

  // Use greenhouse_id from prop or from fetched cluster
  const greenhouseId = greenhouseIdProp ?? cluster?.greenhouse_id ?? '';

  const handleStartIdeation = async () => {
    if (!cluster) return;
    setStartingSession(true);
    setActionError(null);
    try {
      const session = await postJson<{ id: string }>(
        '/api/ideation/sessions',
        { initial_intent: `Exploring opportunity: ${cluster.label}` },
      );
      onOpenChange(false);
      navigate(`/s/${session.id}`);
    } catch {
      setActionError('Failed to start ideation session');
    } finally {
      setStartingSession(false);
    }
  };

  const trendInfo = cluster?.trend ? TREND_STYLES[cluster.trend] ?? null : null;

  // Merge cluster-specific signal counts with global author profiles
  const enrichedAuthors = useMemo(() => {
    if (!cluster?.signals) return [];
    const counts = new Map<string, number>();
    for (const s of cluster.signals) {
      counts.set(s.author, (counts.get(s.author) || 0) + 1);
    }

    const profileMap = new Map(
      (cluster.author_profiles || []).map(p => [p.author, p])
    );

    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        clusterCount: count,
        profile: profileMap.get(name) || null,
      }))
      .sort((a, b) => b.clusterCount - a.clusterCount);
  }, [cluster?.signals, cluster?.author_profiles]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            'fixed right-0 top-0 h-full max-w-lg w-full rounded-none',
            'border-l border-border-default',
            'translate-x-0 translate-y-0 left-auto',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
            'duration-200 flex flex-col'
          )}
        >
          {/* Header */}
          <DialogHeader className="shrink-0">
            <DialogTitle className="pr-8">
              {loading ? (
                <Skeleton className="h-5 w-48" />
              ) : (
                cluster?.label ?? 'Cluster'
              )}
            </DialogTitle>
            {cluster && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-muted">
                  {cluster.signal_count} signal{cluster.signal_count !== 1 ? 's' : ''}
                </span>
                {trendInfo && (
                  <>
                    <span className="text-text-muted text-xs">&middot;</span>
                    <span className={cn('text-xs', trendInfo.className)}>
                      {trendInfo.label}
                    </span>
                  </>
                )}
              </div>
            )}
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Loading state */}
            {loading && (
              <div className="space-y-4 px-1">
                <Skeleton className="h-4 w-32" />
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <Skeleton className="h-4 w-24 mt-4" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="px-1">
                <p className="text-sm text-red-400">
                  Failed to load cluster: {error.message}
                </p>
              </div>
            )}

            {/* Loaded content */}
            {cluster && !loading && (
              <>
                {/* Signal quality distribution */}
                {cluster.quality && (
                  <QualityBar
                    depthScore={cluster.quality.depth_score}
                    substantiveCount={cluster.quality.substantive_count}
                    total={cluster.quality.total}
                  />
                )}

                {/* Demand scoring */}
                {cluster.demand && cluster.demand.score > 0 && (
                  <DemandIndicator
                    score={cluster.demand.score}
                    label={cluster.demand.label}
                    requestRatio={cluster.demand.request_ratio}
                  />
                )}

                {/* Sentiment breakdown */}
                {cluster.sentiment_distribution && cluster.sentiment_distribution.total > 0 && (
                  <SentimentBar distribution={cluster.sentiment_distribution} />
                )}

                {/* Evidence section */}
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
                    Evidence
                  </p>
                  <EvidencePanel signals={cluster.signals} />
                </div>

                {/* Questions being asked */}
                <QuestionsPanel signals={cluster.signals} />

                {/* Signal list */}
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
                    Signals
                  </p>
                  <div className="space-y-1">
                    {cluster.signals.map((signal) => (
                      <div
                        key={signal.id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                          'bg-bg-secondary'
                        )}
                      >
                        {signal.intent && (
                          <IntentBadge intent={signal.intent} />
                        )}
                        <span className="text-sm text-text-primary flex-1 truncate">
                          {signal.title}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
                          {signal.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Who's asking — profile segments */}
                {enrichedAuthors.length > 0 && (
                  <div>
                    <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
                      Who's asking
                    </p>
                    <div className="space-y-1.5">
                      {enrichedAuthors.slice(0, 3).map((author) => (
                        <div key={author.name} className="flex flex-col gap-1 px-2 py-1.5 bg-bg-secondary rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate max-w-[180px]">
                              {author.name}
                            </span>
                            {author.profile?.segment && (
                              <SegmentBadge segment={author.profile.segment} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>
                              {author.clusterCount} signal{author.clusterCount !== 1 ? 's' : ''}
                            </span>
                            {author.profile?.top_intents?.slice(0, 2).map((intent) => (
                              <IntentBadge key={intent} intent={intent} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky actions bar */}
          {cluster && !loading && (
            <div className="shrink-0 pt-4 border-t border-border-default space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={handleStartIdeation}
                  disabled={startingSession}
                  className="flex-1"
                >
                  {startingSession ? 'Starting...' : 'Start Ideation'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPrdOpen(true)}
                  className="flex-1"
                >
                  Generate PRD
                </Button>
              </div>
              {actionError && (
                <p className="text-xs text-red-400">{actionError}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PRD generation dialog */}
      {cluster && (
        <PrdDialog
          open={prdOpen}
          onOpenChange={setPrdOpen}
          clusterId={cluster.id}
          greenhouseId={greenhouseId}
          clusterLabel={cluster.label}
        />
      )}
    </>
  );
}
