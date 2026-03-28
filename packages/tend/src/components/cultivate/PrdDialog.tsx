import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@/components/ui';
import { LoadingSpinner } from '@/components/ui';
import { usePrdGenerator } from '@/hooks/usePrdGenerator';

interface PrdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string;
  greenhouseId: string;
  clusterLabel: string;
}

export function PrdDialog({
  open,
  onOpenChange,
  clusterId,
  greenhouseId,
  clusterLabel,
}: PrdDialogProps) {
  const { generate, markdown, loading, error } = usePrdGenerator();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && clusterId && greenhouseId) {
      generate(clusterId, greenhouseId);
    }
  }, [open, clusterId, greenhouseId, generate]);

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>PRD: {clusterLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="md" />
              <p className="text-sm text-text-muted">Generating PRD...</p>
            </div>
          )}

          {error && (
            <div className="py-4">
              <p className="text-sm text-red-400">
                Failed to generate PRD: {error.message}
              </p>
            </div>
          )}

          {markdown && !loading && (
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed bg-bg-tertiary rounded-lg p-4">
              {markdown}
            </pre>
          )}
        </div>

        <DialogFooter>
          {markdown && !loading && (
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
