import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIConnectionBadge } from './AIConnectionBadge';

describe('AIConnectionBadge', () => {
  describe('status display', () => {
    it('shows "Loading..." when status is loading', () => {
      render(<AIConnectionBadge status="loading" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows "AI Connected" when status is connected', () => {
      render(<AIConnectionBadge status="connected" />);

      expect(screen.getByText('AI Connected')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('shows "Demo Mode" when status is demo', () => {
      render(<AIConnectionBadge status="demo" />);

      expect(screen.getByText('Demo Mode')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('shows "Connecting..." when isConnecting is true', () => {
      render(<AIConnectionBadge status="demo" isConnecting={true} />);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('connect button', () => {
    it('shows Connect button for demo status with draft plan', () => {
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          planStatus="draft"
          onConnect={onConnect}
        />
      );

      expect(screen.getByRole('button', { name: 'Connect AI' })).toBeInTheDocument();
    });

    it('does not show Connect button when status is connected', () => {
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="connected"
          planStatus="draft"
          onConnect={onConnect}
        />
      );

      expect(screen.queryByRole('button', { name: 'Connect AI' })).not.toBeInTheDocument();
    });

    it('does not show Connect button for approved plans', () => {
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          planStatus="approved"
          onConnect={onConnect}
        />
      );

      expect(screen.queryByRole('button', { name: 'Connect AI' })).not.toBeInTheDocument();
    });

    it('does not show Connect button for published plans', () => {
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          planStatus="published"
          onConnect={onConnect}
        />
      );

      expect(screen.queryByRole('button', { name: 'Connect AI' })).not.toBeInTheDocument();
    });

    it('does not show Connect button when no onConnect handler', () => {
      render(<AIConnectionBadge status="demo" planStatus="draft" />);

      expect(screen.queryByRole('button', { name: 'Connect AI' })).not.toBeInTheDocument();
    });

    it('calls onConnect when Connect button is clicked', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          planStatus="draft"
          onConnect={onConnect}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Connect AI' }));

      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('disables Connect button when isConnecting', () => {
      const onConnect = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          planStatus="draft"
          isConnecting={true}
          onConnect={onConnect}
        />
      );

      expect(screen.getByRole('button', { name: 'Connect AI' })).toBeDisabled();
    });
  });

  describe('read-only hint', () => {
    it('shows (Read-only) hint for approved plans in demo mode', () => {
      render(<AIConnectionBadge status="demo" planStatus="approved" />);

      expect(screen.getByText('(Read-only)')).toBeInTheDocument();
    });

    it('shows (Read-only) hint for published plans in demo mode', () => {
      render(<AIConnectionBadge status="demo" planStatus="published" />);

      expect(screen.getByText('(Read-only)')).toBeInTheDocument();
    });

    it('does not show (Read-only) hint for draft plans', () => {
      render(<AIConnectionBadge status="demo" planStatus="draft" />);

      expect(screen.queryByText('(Read-only)')).not.toBeInTheDocument();
    });

    it('does not show (Read-only) hint when connected', () => {
      render(<AIConnectionBadge status="connected" planStatus="approved" />);

      expect(screen.queryByText('(Read-only)')).not.toBeInTheDocument();
    });
  });

  describe('error display', () => {
    it('shows error message when connectError is set', () => {
      render(
        <AIConnectionBadge
          status="demo"
          connectError="AI service unavailable"
        />
      );

      expect(screen.getByText('AI service unavailable')).toBeInTheDocument();
    });

    it('shows dismiss button when error and onClearError provided', () => {
      const onClearError = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          connectError="Connection failed"
          onClearError={onClearError}
        />
      );

      expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument();
    });

    it('calls onClearError when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const onClearError = vi.fn();
      render(
        <AIConnectionBadge
          status="demo"
          connectError="Connection failed"
          onClearError={onClearError}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Dismiss error' }));

      expect(onClearError).toHaveBeenCalledTimes(1);
    });

    it('does not show error when connectError is null', () => {
      render(<AIConnectionBadge status="demo" connectError={null} />);

      expect(screen.queryByText('AI service unavailable')).not.toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('applies correct class for connected status', () => {
      const { container } = render(<AIConnectionBadge status="connected" />);

      expect(container.querySelector('.ai-connection-badge--connected')).toBeInTheDocument();
    });

    it('applies correct class for demo status', () => {
      const { container } = render(<AIConnectionBadge status="demo" />);

      expect(container.querySelector('.ai-connection-badge--demo')).toBeInTheDocument();
    });

    it('applies correct class for loading status', () => {
      const { container } = render(<AIConnectionBadge status="loading" />);

      expect(container.querySelector('.ai-connection-badge--loading')).toBeInTheDocument();
    });

    it('applies connecting class when isConnecting', () => {
      const { container } = render(
        <AIConnectionBadge status="demo" isConnecting={true} />
      );

      expect(container.querySelector('.connecting')).toBeInTheDocument();
    });
  });
});
