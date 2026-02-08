interface KeywordTagProps {
  keyword: string;
}

function truncateKeyword(keyword: string, maxLength = 15): string {
  if (keyword.length <= maxLength) return keyword;
  return keyword.slice(0, maxLength).trim() + '…';
}

export function KeywordTag({ keyword }: KeywordTagProps) {
  const displayText = truncateKeyword(keyword);
  const needsTooltip = keyword.length > 15;

  return (
    <span
      className="inline-block bg-accent-cyan/10 text-accent-cyan text-xs px-2 py-0.5 rounded-full"
      title={needsTooltip ? keyword : undefined}
    >
      {displayText}
    </span>
  );
}
