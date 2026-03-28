import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QAMessageCard } from './QAMessageCard';
import type { QuestionBlockingLevel } from '@/types/plan';

describe('QAMessageCard', () => {
  const baseProps = {
    questionText: 'What is the deployment strategy?',
    answerText: 'We will use blue-green deployment',
    agentName: 'DeploymentAgent',
    agentRole: 'Infrastructure',
    answeredAt: '2026-01-31T10:00:00Z',
  };

  it('renders question and answer text', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('What is the deployment strategy?')).toBeInTheDocument();
    expect(screen.getByText('We will use blue-green deployment')).toBeInTheDocument();
  });

  it('renders agent name and role', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('DeploymentAgent')).toBeInTheDocument();
    expect(screen.getByText(/Infrastructure/)).toBeInTheDocument();
  });

  it('renders hard_block badge with error styling', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="hard_block"
        questionId="q1"
      />
    );

    const badge = screen.getByText('BLOCKING');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-error');
    expect(badge).toHaveClass('text-white');
  });

  it('renders soft_block badge with warning styling', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="soft_block"
        questionId="q1"
      />
    );

    const badge = screen.getByText('SOFT BLOCK');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-warning/20');
    expect(badge).toHaveClass('text-warning');
  });

  it('renders preference badge with warning styling', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="preference"
        questionId="q1"
      />
    );

    const badge = screen.getByText('PREFERENCE');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-warning/20');
    expect(badge).toHaveClass('text-warning');
  });

  it('renders fyi badge with cyan styling', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    const badge = screen.getByText('FYI');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-accent-cyan/20');
    expect(badge).toHaveClass('text-accent-cyan');
  });

  it('renders timestamp in relative format for recent messages', () => {
    // Mock current time to be 5 minutes after the answer
    const now = new Date('2026-01-31T10:05:00Z');
    vi.setSystemTime(now);

    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('5 mins ago')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders timestamp in absolute format for older messages', () => {
    // Mock current time to be 2 hours after the answer
    const now = new Date('2026-01-31T12:00:00Z');
    vi.setSystemTime(now);

    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    // Should show absolute time (10:00 AM)
    expect(screen.getByText(/10:00 AM/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders "Just now" for very recent messages', () => {
    // Mock current time to be 30 seconds after the answer
    const now = new Date('2026-01-31T10:00:30Z');
    vi.setSystemTime(now);

    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('Just now')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('displays "Question Answered" header', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('Question Answered')).toBeInTheDocument();
  });

  it('displays question emoji icon', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
      />
    );

    expect(screen.getByText('❓')).toBeInTheDocument();
  });

  it('uses timestamp prop over answeredAt when provided', () => {
    const now = new Date('2026-01-31T10:03:00Z');
    vi.setSystemTime(now);

    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="fyi"
        questionId="q1"
        timestamp="2026-01-31T10:02:00Z"
      />
    );

    // Should use timestamp (10:02), not answeredAt (10:00)
    expect(screen.getByText('1 min ago')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('has proper accessibility structure', () => {
    render(
      <QAMessageCard
        {...baseProps}
        blockingLevel="hard_block"
        questionId="q1"
      />
    );

    // Verify question and answer labels are present
    expect(screen.getByText('Question')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  describe('blocking level badge colors', () => {
    const testCases: Array<{
      level: QuestionBlockingLevel;
      label: string;
      bgClass: string;
      textClass: string;
    }> = [
      {
        level: 'hard_block',
        label: 'BLOCKING',
        bgClass: 'bg-error',
        textClass: 'text-white',
      },
      {
        level: 'soft_block',
        label: 'SOFT BLOCK',
        bgClass: 'bg-warning/20',
        textClass: 'text-warning',
      },
      {
        level: 'preference',
        label: 'PREFERENCE',
        bgClass: 'bg-warning/20',
        textClass: 'text-warning',
      },
      {
        level: 'fyi',
        label: 'FYI',
        bgClass: 'bg-accent-cyan/20',
        textClass: 'text-accent-cyan',
      },
    ];

    testCases.forEach(({ level, label, bgClass, textClass }) => {
      it(`renders ${level} with correct badge styling`, () => {
        render(
          <QAMessageCard
            {...baseProps}
            blockingLevel={level}
            questionId="q1"
          />
        );

        const badge = screen.getByText(label);
        expect(badge).toHaveClass(bgClass);
        expect(badge).toHaveClass(textClass);
      });
    });
  });

  describe('visual styling', () => {
    it('has cyan accent border on the left', () => {
      const { container } = render(
        <QAMessageCard
          {...baseProps}
          blockingLevel="fyi"
          questionId="q1"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border-l-4');
      expect(card).toHaveClass('border-l-accent-cyan');
    });

    it('has card background styling', () => {
      const { container } = render(
        <QAMessageCard
          {...baseProps}
          blockingLevel="fyi"
          questionId="q1"
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-bg-card');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-border-subtle');
    });
  });
});
