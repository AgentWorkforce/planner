import type { SignalWithExtraction } from '@/hooks/useCultivateCluster';

interface EvidencePanelProps {
  signals: SignalWithExtraction[];
}

/** Maximum number of quotes to display */
const MAX_QUOTES = 8;

interface QuoteWithAttribution {
  text: string;
  author: string;
  sourceType: string;
}

function extractQuotes(signals: SignalWithExtraction[]): QuoteWithAttribution[] {
  const quotes: QuoteWithAttribution[] = [];

  for (const signal of signals) {
    if (!signal.extraction?.quotes) continue;

    for (const quote of signal.extraction.quotes) {
      quotes.push({
        text: quote,
        author: signal.author,
        sourceType: signal.source_type,
      });

      if (quotes.length >= MAX_QUOTES) return quotes;
    }
  }

  return quotes;
}

export function EvidencePanel({ signals }: EvidencePanelProps) {
  const quotes = extractQuotes(signals);

  if (quotes.length === 0) {
    return (
      <p className="text-xs text-text-muted italic py-2">
        No direct quotes available
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote, index) => (
        <div
          key={index}
          className="border-l-2 border-[var(--color-accent-primary)] pl-3"
        >
          <p className="text-sm text-text-secondary italic leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-xs text-text-muted mt-1">
            &mdash; {quote.author}, {quote.sourceType}
          </p>
        </div>
      ))}
    </div>
  );
}
