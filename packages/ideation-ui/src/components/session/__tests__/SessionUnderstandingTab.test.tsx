import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionUnderstandingTab } from '../SessionUnderstandingTab';

// Mock the SpecialistCard component
vi.mock('@/components/specialists', () => ({
  SpecialistCard: ({ name, observations }: { name: string; observations: Record<string, unknown> }) => (
    <div data-testid={`specialist-card-${name}`}>
      <span>Specialist: {name}</span>
      <span>Observations: {JSON.stringify(observations)}</span>
    </div>
  ),
}));

describe('SessionUnderstandingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const emptyUnderstanding = {};

  const mockUnderstanding = {
    'Architect': {
      keywords: ['API', 'REST'],
      confidence: 'forming',
      observations: ['Consider microservices'],
      questions: ['What about auth?'],
      concerns: ['Scalability'],
    },
    'Designer': {
      keywords: ['UI', 'components'],
      confidence: 'exploring',
    },
  };

  const renderComponent = (props = {}) => {
    const defaultProps = {
      understanding: emptyUnderstanding,
      activeSpecialists: [],
      loading: false,
    };

    return render(
      <MemoryRouter>
        <SessionUnderstandingTab {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  it('shows loading skeleton when loading=true', () => {
    const { container } = renderComponent({ loading: true });

    // Check for skeleton elements by their distinctive class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Verify the header is present
    expect(screen.getByText('Specialist Observations')).toBeInTheDocument();
  });

  it('shows empty state when understanding is empty {}', () => {
    renderComponent({ understanding: emptyUnderstanding });

    // Verify empty state message
    expect(screen.getByText(/No specialist observations yet/i)).toBeInTheDocument();
    expect(screen.getByText(/As you brainstorm, specialists will contribute insights/i)).toBeInTheDocument();

    // Verify the badge shows 0
    const badge = screen.getByText('0');
    expect(badge).toBeInTheDocument();

    // Verify header is present
    expect(screen.getByText('Specialist Observations')).toBeInTheDocument();
  });

  it('renders SpecialistCard for each specialist in understanding', () => {
    renderComponent({ understanding: mockUnderstanding });

    // Verify both specialist cards are rendered
    const architectCard = screen.getByTestId('specialist-card-Architect');
    expect(architectCard).toBeInTheDocument();
    expect(architectCard).toHaveTextContent('Specialist: Architect');

    const designerCard = screen.getByTestId('specialist-card-Designer');
    expect(designerCard).toBeInTheDocument();
    expect(designerCard).toHaveTextContent('Specialist: Designer');

    // Verify that SpecialistCard receives the observations
    expect(architectCard).toHaveTextContent('"keywords":["API","REST"]');
    expect(designerCard).toHaveTextContent('"keywords":["UI","components"]');
  });

  it('shows correct count in badge', () => {
    renderComponent({ understanding: mockUnderstanding });

    // Verify the badge shows count of specialists (2 in mockUnderstanding)
    const badge = screen.getByText('2');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-xs');

    // Verify header
    expect(screen.getByText('Specialist Observations')).toBeInTheDocument();
  });

  it('empty state shows "No specialist observations yet" message', () => {
    renderComponent({ understanding: {} });

    // Verify the exact empty state message
    const emptyMessage = screen.getByText(/No specialist observations yet/i);
    expect(emptyMessage).toBeInTheDocument();

    const helperText = screen.getByText(/As you brainstorm, specialists will contribute insights/i);
    expect(helperText).toBeInTheDocument();
  });

  it('passes roleHint to SpecialistCard when activeSpecialists provided', () => {
    const activeSpecialists = [
      { name: 'Architect', roleHint: 'Backend' },
      { name: 'Designer', roleHint: 'UX' },
    ];

    renderComponent({
      understanding: mockUnderstanding,
      activeSpecialists,
    });

    // The mocked component doesn't render roleHint, but we verify cards are rendered
    const architectCard = screen.getByTestId('specialist-card-Architect');
    const designerCard = screen.getByTestId('specialist-card-Designer');

    expect(architectCard).toBeInTheDocument();
    expect(designerCard).toBeInTheDocument();
  });

  it('renders grid layout for specialist cards', () => {
    const { container } = renderComponent({ understanding: mockUnderstanding });

    // Find the grid container
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'gap-4');
  });

  it('does not render specialist cards in loading state', () => {
    renderComponent({ understanding: mockUnderstanding, loading: true });

    // Specialist cards should not be present during loading
    const architectCard = screen.queryByTestId('specialist-card-Architect');
    const designerCard = screen.queryByTestId('specialist-card-Designer');

    expect(architectCard).not.toBeInTheDocument();
    expect(designerCard).not.toBeInTheDocument();
  });

  it('does not render specialist cards in empty state', () => {
    renderComponent({ understanding: emptyUnderstanding });

    // Specialist cards should not be present in empty state
    const cards = screen.queryByTestId(/specialist-card-/);
    expect(cards).not.toBeInTheDocument();
  });

  it('maintains correct structure with header, badge, and content', () => {
    renderComponent({ understanding: mockUnderstanding });

    // Verify header structure
    const header = screen.getByText('Specialist Observations');
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe('H2');

    // Verify badge is present with correct count
    const badge = screen.getByText('2');
    expect(badge).toBeInTheDocument();

    // Verify specialist cards are rendered
    expect(screen.getByTestId('specialist-card-Architect')).toBeInTheDocument();
    expect(screen.getByTestId('specialist-card-Designer')).toBeInTheDocument();
  });
});
