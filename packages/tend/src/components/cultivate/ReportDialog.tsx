import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  LoadingSpinner,
} from '@/components/ui';
import { useReportGenerator } from '@/hooks/useReports';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  greenhouseId: string;
  greenhouseName?: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  greenhouseId,
  greenhouseName,
}: ReportDialogProps) {
  const { generate, markdown, loading, error } = useReportGenerator();
  const [copied, setCopied] = useState(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current && greenhouseId) {
      generate(greenhouseId);
    }
    prevOpenRef.current = open;
  }, [open, greenhouseId, generate]);

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

  const handleRegenerate = () => {
    if (greenhouseId) {
      generate(greenhouseId);
    }
  };

  const title = greenhouseName
    ? `Synthesis Report: ${greenhouseName}`
    : 'Synthesis Report';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="md" />
              <p className="text-sm text-text-muted">Generating synthesis report...</p>
            </div>
          )}

          {error && (
            <div className="py-4">
              <p className="text-sm text-red-400">
                Failed to generate report: {error.message}
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
            <>
              <Button variant="secondary" onClick={handleRegenerate}>
                Regenerate
              </Button>
              <Button variant="secondary" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </>
          )}
          {error && !loading && (
            <Button variant="secondary" onClick={handleRegenerate}>
              Retry
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
