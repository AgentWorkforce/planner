import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SessionTabBar } from '../SessionTabBar';

describe('SessionTabBar', () => {
  const defaultProps = {
    activeTab: 'chat' as const,
    onTabChange: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <SessionTabBar {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  it('renders Chat tab as active when activeTab="chat"', () => {
    renderComponent({ activeTab: 'chat' });

    const chatTab = screen.getByRole('radio', { name: 'Chat view' });
    expect(chatTab).toBeInTheDocument();
    expect(chatTab).toHaveAttribute('data-state', 'on');
  });

  it('renders Understanding tab as active when activeTab="understanding"', () => {
    renderComponent({ activeTab: 'understanding' });

    const understandingTab = screen.getByRole('radio', { name: 'Understanding view' });
    expect(understandingTab).toBeInTheDocument();
    expect(understandingTab).toHaveAttribute('data-state', 'on');
  });

  it('calls onTabChange("understanding") when Understanding tab clicked', async () => {
    const mockOnTabChange = vi.fn();
    renderComponent({ activeTab: 'chat', onTabChange: mockOnTabChange });

    const understandingTab = screen.getByRole('radio', { name: 'Understanding view' });
    await userEvent.click(understandingTab);

    expect(mockOnTabChange).toHaveBeenCalledWith('understanding');
    expect(mockOnTabChange).toHaveBeenCalledTimes(1);
  });

  it('calls onTabChange("chat") when Chat tab clicked', async () => {
    const mockOnTabChange = vi.fn();
    renderComponent({ activeTab: 'understanding', onTabChange: mockOnTabChange });

    const chatTab = screen.getByRole('radio', { name: 'Chat view' });
    await userEvent.click(chatTab);

    expect(mockOnTabChange).toHaveBeenCalledWith('chat');
    expect(mockOnTabChange).toHaveBeenCalledTimes(1);
  });

  it('shows badge with count when understandingCount > 0', () => {
    renderComponent({ understandingCount: 3 });

    // Badge should be visible and contain the count
    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-accent-cyan/20', 'text-accent-cyan');
  });

  it('does not show badge when understandingCount is 0', () => {
    renderComponent({ understandingCount: 0 });

    // Badge should not be present
    const badge = screen.queryByText('0');
    expect(badge).not.toBeInTheDocument();
  });

  it('does not show badge when understandingCount is undefined', () => {
    renderComponent({ understandingCount: undefined });

    // Badge container should not render any badge
    const understandingTab = screen.getByRole('radio', { name: 'Understanding view' });
    const parentElement = understandingTab.parentElement;
    const badges = parentElement?.querySelectorAll('.bg-accent-cyan\\/20');
    expect(badges?.length).toBe(0);
  });

  it('renders tab icons correctly', () => {
    renderComponent();

    // Check that both tabs have their icons (by verifying the text content)
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Understanding')).toBeInTheDocument();
  });

  it('applies correct styling to the tab bar', () => {
    const { container } = renderComponent();

    const tabBar = container.firstChild;
    expect(tabBar).toHaveClass('h-12', 'flex', 'items-center', 'px-4', 'border-b');
  });
});
