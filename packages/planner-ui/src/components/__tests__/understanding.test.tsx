/**
 * Tests for Understanding UI Components
 *
 * Tests:
 * - ConfidenceBadge: renders correct color per level
 * - AgentObservationCard: renders all observation fields, collapse/expand
 * - UnderstandingTab: renders cards for each role, empty state
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { AgentObservationCard } from '../AgentObservationCard';
import { UnderstandingTab } from '../UnderstandingTab';
import type { AgentObservations, Understanding } from '@/types';

describe('ConfidenceBadge', () => {
  it('renders "Exploring" with purple styling', () => {
    render(<ConfidenceBadge confidence="exploring" />);
    const badge = screen.getByText('Exploring');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-accent-purple');
  });

  it('renders "Forming" with cyan styling', () => {
    render(<ConfidenceBadge confidence="forming" />);
    const badge = screen.getByText('Forming');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-accent-cyan');
  });

  it('renders "Confident" with success styling', () => {
    render(<ConfidenceBadge confidence="confident" />);
    const badge = screen.getByText('Confident');
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass('text-success');
  });

  it('renders compact variant with title attribute', () => {
    render(<ConfidenceBadge confidence="exploring" variant="compact" />);
    const badge = screen.getByTitle('Exploring');
    expect(badge).toBeInTheDocument();
  });
});

describe('AgentObservationCard', () => {
  const mockObservations: AgentObservations = {
    observations: ['Pattern X is common', 'Consider approach Y'],
    keywords: ['performance', 'scalability'],
    questions: ['What about edge cases?'],
    concerns: ['Memory usage may be high'],
    confidence: 'forming',
    updated_at: '2024-01-15T10:00:00Z',
    updated_by: 'architect-agent',
  };

  it('renders role name capitalized', () => {
    render(<AgentObservationCard role="architect" observations={mockObservations} />);
    expect(screen.getByText('Architect')).toBeInTheDocument();
  });

  it('renders all observation fields', () => {
    render(<AgentObservationCard role="architect" observations={mockObservations} />);

    // Observations
    expect(screen.getByText('Pattern X is common')).toBeInTheDocument();
    expect(screen.getByText('Consider approach Y')).toBeInTheDocument();

    // Keywords as chips
    expect(screen.getByText('performance')).toBeInTheDocument();
    expect(screen.getByText('scalability')).toBeInTheDocument();

    // Questions
    expect(screen.getByText('What about edge cases?')).toBeInTheDocument();

    // Concerns
    expect(screen.getByText('Memory usage may be high')).toBeInTheDocument();
  });

  it('renders confidence badge', () => {
    render(<AgentObservationCard role="architect" observations={mockObservations} />);
    // Look for the title attribute on compact badge
    expect(screen.getByTitle('Forming')).toBeInTheDocument();
  });

  it('collapses and expands on header click', () => {
    render(<AgentObservationCard role="architect" observations={mockObservations} />);

    // Content should be visible initially (default expanded)
    expect(screen.getByText('Pattern X is common')).toBeVisible();

    // Click header to collapse
    const header = screen.getByRole('button');
    fireEvent.click(header);

    // Content should be hidden (max-h-0 opacity-0)
    const content = screen.getByText('Pattern X is common').closest('div[class*="overflow-hidden"]');
    expect(content).toHaveClass('max-h-0');

    // Click again to expand
    fireEvent.click(header);

    // Content should be visible again
    expect(content).not.toHaveClass('max-h-0');
  });

  it('shows empty message when no observations', () => {
    render(<AgentObservationCard role="architect" observations={{}} />);
    expect(screen.getByText('No observations recorded yet.')).toBeInTheDocument();
  });
});

describe('UnderstandingTab', () => {
  const mockUnderstanding: Understanding = {
    architect: {
      observations: ['System uses microservices'],
      confidence: 'confident',
    },
    security: {
      concerns: ['OWASP top 10 not addressed'],
      confidence: 'exploring',
    },
  };

  it('renders a card for each role', () => {
    render(<UnderstandingTab understanding={mockUnderstanding} />);

    expect(screen.getByText('Architect')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('shows observation count badge', () => {
    render(<UnderstandingTab understanding={mockUnderstanding} />);

    // Total observations: 1 (architect) + 1 (security) = 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows role count', () => {
    render(<UnderstandingTab understanding={mockUnderstanding} />);
    expect(screen.getByText('2 roles')).toBeInTheDocument();
  });

  it('renders empty state when no observations', () => {
    render(<UnderstandingTab understanding={undefined} />);

    expect(screen.getByText('No agent observations yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Chat with PlannerLead to start ideation/)
    ).toBeInTheDocument();
  });

  it('renders empty state when understanding is empty object', () => {
    render(<UnderstandingTab understanding={{}} />);
    expect(screen.getByText('No agent observations yet')).toBeInTheDocument();
  });

  it('sorts roles in preferred order (architect, designer, tester, security)', () => {
    const understanding: Understanding = {
      security: { observations: ['sec'] },
      tester: { observations: ['test'] },
      architect: { observations: ['arch'] },
      designer: { observations: ['design'] },
    };

    render(<UnderstandingTab understanding={understanding} />);

    const cards = screen.getAllByRole('button');
    const roleNames = cards.map((card) => card.textContent);

    // Should be in order: Architect, Designer, Tester, Security
    expect(roleNames[0]).toContain('Architect');
    expect(roleNames[1]).toContain('Designer');
    expect(roleNames[2]).toContain('Tester');
    expect(roleNames[3]).toContain('Security');
  });
});
