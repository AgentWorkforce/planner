import { Button } from '@/components/ui';

interface OnboardingPromptProps {
  onQuickStart: () => void;
}

/**
 * OnboardingPrompt — compact card shown in the dashboard greeting slot
 * when no Cultivate greenhouses are configured yet.
 */
export function OnboardingPrompt({ onQuickStart }: OnboardingPromptProps) {
  return (
    <div className="bg-bg-secondary rounded-2xl px-5 py-4 shadow-sm">
      <p className="text-text-primary text-sm font-medium">
        Set up signal intake
      </p>
      <p className="text-text-secondary text-sm mt-1">
        Connect your sources to discover opportunities from customer feedback.
      </p>
      <div className="mt-3">
        <Button variant="primary" size="sm" onClick={onQuickStart}>
          Quick Start
        </Button>
      </div>
    </div>
  );
}
